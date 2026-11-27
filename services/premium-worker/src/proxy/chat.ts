// POST /v1/chat/completions (plan 8.2): the hot path. Order: token, idempotency key, rate limit,
// body cap, allowlist, period, reserve, upstream, settle. Settlement always runs in waitUntil so
// a client disconnect cannot skip it; an unknown outcome is charged at the reservation (fail closed).
import { isBreakerOpen, openBreaker } from '../breaker';
import type { Ctx } from '../context';
import { dayKey } from '../db';
import { DAY_MS, effectiveCap, usedPct } from '../finance';
import {
  ApiError,
  errorResponse,
  isoTime,
  readBodyCapped,
  type ErrorCode,
  type ErrorExtra,
} from '../http';
import { sha256HexOfText } from '../identity/crypto';
import { requireSession } from '../identity/devices';
import {
  findLivePeriod,
  reserve,
  settleWithOverrun,
  type PeriodRow,
  type ReserveOutcome,
} from '../ledger';
import { enforceRateLimit } from '../limiter';
import { lineagePrefix, type LogEvent } from '../log';
import { renewedLivePeriod } from '../billing/periods';
import { costToMicro, selectGateway, type Gateway } from '../upstream/select';
import type { UpstreamName } from '../upstream/types';
import { allowlistRequest } from './allowlist';
import { parseJsonUsage, parseTail, TailBuffer } from './sse';

/** Patchable by tests so none of them waits 30 s. */
export const TIMEOUTS = { overallMs: 55_000, streamIdleMs: 30_000 };

const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;
/**
 * The Iron consent version Otari needs; a newer app sends a higher one, which is fine.
 * The header only says which consent wording the sending build showed. A modified client can send
 * any value and the Worker keeps no consent record, so this check is not proof of consent.
 */
const MIN_CONSENT_VERSION = 4;

function hasRequiredConsent(request: Request): boolean {
  const header = request.headers.get('x-musclog-consent-version') ?? '';

  // A canonical integer only ("04", "4.0" and " 4" are not what the app sends).
  return /^[1-9]\d*$/.test(header) && Number(header) >= MIN_CONSENT_VERSION;
}

/** Percentage of the cap left after this request's reservation `r`, 0..100. */
const budgetPct = (p: PeriodRow, r: number, now: number): number => {
  const cap = effectiveCap(p, now);
  if (cap <= 0) return 0;
  const left = (cap - p.spent_u - p.reserved_u - r) / cap;
  return Math.min(100, Math.max(0, Math.floor(left * 100)));
};

interface RequestLog {
  lineage?: string;
  model?: string;
  upstream?: UpstreamName;
}

type EmitArg = Omit<LogEvent, 'route' | 'latency_ms' | 'lineage_prefix' | 'model' | 'upstream'>;

export async function handleChatCompletions(request: Request, ctx: Ctx): Promise<Response> {
  const started = ctx.deps.now();
  const rl: RequestLog = {};
  const emit = (e: EmitArg) =>
    ctx.deps.log.log({
      route: '/v1/chat/completions',
      latency_ms: ctx.deps.now() - started,
      lineage_prefix: rl.lineage,
      model: rl.model,
      upstream: rl.upstream,
      ...e,
    });
  try {
    return await run(request, ctx, rl, emit);
  } catch (e) {
    if (e instanceof ApiError) emit({ status: e.status, code: e.code });
    throw e;
  }
}

async function run(request: Request, ctx: Ctx, rl: RequestLog, emit: EmitLog): Promise<Response> {
  const { env, config, deps } = ctx;
  const db = env.DB;
  const now = deps.now();

  // 1. Session token.
  const claims = await requireSession(request, ctx, now);

  // 2. Idempotency-Key.
  const idemKey = request.headers.get('idempotency-key');
  if (!idemKey || !KEY_RE.test(idemKey))
    throw new ApiError(400, 'invalid_request', { path: 'header.Idempotency-Key' });

  // 3. Rate limiter (required in production and staging).
  await enforceRateLimit(ctx, 'chat:' + claims.rc, 2);

  // 4. Body cap before any D1 work, then the allowlist and the reservation bound.
  const raw = await readBodyCapped(request, config.limits.body_max_bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new ApiError(400, 'invalid_request', { path: 'body' });
  }
  const req = allowlistRequest(parsed, config);
  // 5. The caller's live period, diagnosing why there is none, then the gateway and its consent.
  const period = await requirePeriod(ctx, claims.rc, now);
  rl.lineage = lineagePrefix(period.lineage_key);
  const gateway = await selectGateway(ctx);
  rl.upstream = gateway.name;
  if (gateway.requiresConsent && !hasRequiredConsent(request))
    throw new ApiError(403, 'consent_required');
  const r = gateway.reservationBound(req);
  const budgetHeader = { 'x-musclog-budget-remaining-pct': String(budgetPct(period, r, now)) };
  const fail = (
    status: number,
    code: ErrorCode,
    extra: ErrorExtra = {},
    log?: Partial<LogEvent>
  ) => {
    emit({ status, code, ...log });
    return errorResponse(status, code, extra, budgetHeader);
  };

  // 6. The upstream body and its hash. The Idempotency-Key is bound to the gateway-NEUTRAL body
  // (plus `user`), so flipping the toggle between a request and its retry is not a mismatch.
  const user = period.lineage_key.slice(0, 16);
  const bh = await sha256HexOfText(JSON.stringify({ ...req.neutral, user }));
  const upstreamBody = gateway.buildBody(req);
  rl.model = String(upstreamBody.model);
  const bodyText = JSON.stringify({ ...upstreamBody, user });

  // 7. Reserve. A D1 failure fails closed, with no upstream call.
  const pk = period.payment_key;
  let outcome: ReserveOutcome;
  try {
    outcome = (
      await reserve(db, {
        pk,
        id: idemKey,
        rc: claims.rc,
        bh,
        r,
        hold: deps.randomHex(),
        now,
        day: dayKey(now),
        maxReq: config.limits.max_requests_per_day,
        maxInflight: config.limits.max_inflight,
      })
    ).outcome;
  } catch {
    return fail(503, 'hosted_disabled', {}, { severity: 'error' });
  }
  if (outcome !== 'admitted') {
    const refusal = RESERVE_REFUSALS[outcome](period, now);
    return fail(refusal.status, refusal.code, refusal.extra);
  }

  // 8-9. Upstream call and settlement.
  const relay: Relay = {
    ctx,
    r,
    gateway,
    unexpectedProvider: false,
    emit,
    budgetHeader,
    settle: (final, a) => settleCharge(ctx, { pk, id: idemKey, final, a }, r, emit),
  };
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(
    () => {
      timedOut = true;
      ac.abort();
    },
    req.stream ? TIMEOUTS.streamIdleMs : TIMEOUTS.overallMs
  );

  let res: Response;
  try {
    res = await gateway.chatCompletions(bodyText, { signal: ac.signal });
  } catch {
    clearTimeout(timer);
    // Unknown outcome: charged at the reservation.
    return failAfterCharge(relay, timedOut, r);
  }

  if (!res.ok) {
    clearTimeout(timer);
    return refuseUpstream(relay, db, res);
  }

  const check = gateway.verifyResponse(res, upstreamBody);
  relay.unexpectedProvider = check.unexpectedProvider;
  // No verification header means the provider could not be checked. The pinned selector still never
  // falls back, so this is not a breach, but it must be visible: the check above silently stops working.
  if (check.unverifiedCode) {
    emit({ status: res.status, code: check.unverifiedCode, severity: 'error' });
  }
  const genHeader = gateway.generationHeader(res);
  if (!req.stream) {
    return relayJson(relay, res, genHeader, timer, () => timedOut);
  }

  clearTimeout(timer);
  return relayStream(relay, res, genHeader, ac);
}

// ----- step 5: the live period --------------------------------------------------------------

/** The caller's live period, or the ApiError that says why there is none. */
async function requirePeriod(ctx: Ctx, rc: string, now: number): Promise<PeriodRow> {
  const db = ctx.env.DB;
  const period = await findLivePeriod(db, rc, now);
  if (period) return period;

  if (await isBreakerOpen(db)) throw new ApiError(503, 'hosted_disabled');
  const df = await db
    .prepare("SELECT value FROM meta WHERE key = 'daily_full'")
    .first<{ value: string }>();
  if (df?.value === '1') throw new ApiError(503, 'daily_full');
  const dev = await db
    .prepare("SELECT lineage_key FROM devices WHERE rc_id = ?1 AND status = 'active'")
    .bind(rc)
    .first<{ lineage_key: string }>();
  if (!dev) throw new ApiError(401, 'unknown_device');
  const revived = await renewedLivePeriod(ctx, rc, dev.lineage_key, now);
  if (!revived) throw new ApiError(403, 'subscription_required');
  return revived;
}

// ----- step 7: what each refused reservation answers ----------------------------------------

type Refusal = { status: number; code: ErrorCode; extra?: ErrorExtra };

const RESERVE_REFUSALS: Record<
  Exclude<ReserveOutcome, 'admitted'>,
  (period: PeriodRow, now: number) => Refusal
> = {
  in_progress: () => ({ status: 409, code: 'in_progress', extra: { retry_after: 2 } }),
  already_processed: () => ({ status: 409, code: 'already_processed' }),
  idempotency_mismatch: () => ({ status: 422, code: 'idempotency_mismatch' }),
  budget_exhausted: (period, now) => ({
    status: 402,
    code: 'budget_exhausted',
    extra: { used_pct: usedPct(period, now), resets_at: isoTime(period.period_end) },
  }),
  daily_limit: (_period, now) => ({
    status: 402,
    code: 'daily_limit',
    extra: { resets_at: isoTime((Math.floor(now / DAY_MS) + 1) * DAY_MS) },
  }),
  busy: () => ({ status: 429, code: 'busy', extra: { retry_after: 2 } }),
  hosted_disabled: () => ({ status: 503, code: 'hosted_disabled' }),
  daily_full: () => ({ status: 503, code: 'daily_full' }),
  no_device: () => ({ status: 401, code: 'unknown_device' }),
  no_period: () => ({ status: 403, code: 'subscription_required' }),
};

// ----- steps 8-9: the upstream call and its settlement --------------------------------------

type EmitLog = (e: EmitArg) => void;

/** What every way of ending the upstream call needs: the reservation, the log and the settle. */
interface Relay {
  ctx: Ctx;
  /** The reservation bound, in micro-USD: charged when the real cost is unknown. */
  r: number;
  gateway: Gateway;
  /** Otari answered from another provider than the pinned one, or fell back: open the breaker once settled. */
  unexpectedProvider: boolean;
  emit: EmitLog;
  budgetHeader: Record<string, string>;
  settle(final: 'settled' | 'refunded', a: number): Promise<{ overrun: boolean }>;
}

async function settleCharge(
  ctx: Ctx,
  charge: { pk: string; id: string; final: 'settled' | 'refunded'; a: number },
  r: number,
  emit: EmitLog
): Promise<{ overrun: boolean }> {
  const { deps } = ctx;
  try {
    const out = await settleWithOverrun(
      ctx.env.DB,
      { ...charge, now: deps.now(), day: dayKey(deps.now()) },
      r,
      ctx.config.breaker.overruns_24h
    );
    return { overrun: out.overrun };
  } catch {
    // The cron sweep charges r after expiry: fail closed.
    emit({ status: 500, code: 'settle_failed', severity: 'error' });
    return { overrun: false };
  }
}

async function maybeOpenUnexpectedProvider(relay: Relay): Promise<void> {
  if (!relay.unexpectedProvider) return;
  try {
    await openBreaker(relay.ctx.env.DB, 'upstream_unexpected_provider');
  } catch {
    /* logged below */
  }
  relay.emit({ status: 503, code: 'upstream_unexpected_provider', severity: 'high' });
}

/** Settles at the measured cost (the reservation when none is known) and logs the result. */
async function settleAndLog(
  relay: Relay,
  cost: { costUsd: number | null; generationIds: (string | null)[] },
  log: { status: number; code?: string; tokens?: number }
): Promise<void> {
  let a: number | null = cost.costUsd !== null ? costToMicro(cost.costUsd) : null;
  if (a === null) {
    for (const id of cost.generationIds) {
      a = await relay.gateway.lookupCost(id);
      if (a !== null) break;
    }
  }
  const charged = a ?? relay.r;
  const s = await relay.settle('settled', charged);
  relay.emit({ ...log, cost_u: charged, overrun: s.overrun });
  await maybeOpenUnexpectedProvider(relay);
}

const tokensOf = (u: { promptTokens: number | null; completionTokens: number | null }) =>
  u.promptTokens !== null && u.completionTokens !== null
    ? u.promptTokens + u.completionTokens
    : undefined;

/**
 * Ends a request that failed after the reservation: settles it (charged `charge`, or refunded),
 * logs the outcome in the background and answers the error.
 */
function endWithError(
  relay: Relay,
  end: {
    final: 'settled' | 'refunded';
    charge: number;
    status: number;
    code: ErrorCode;
    severity?: LogEvent['severity'];
  }
): Response {
  const { final, charge, status, code, severity } = end;
  relay.ctx.exec.waitUntil(
    relay
      .settle(final, charge)
      .then((s) => relay.emit({ status, code, cost_u: charge, overrun: s.overrun, severity }))
      .then(() => maybeOpenUnexpectedProvider(relay))
  );
  return errorResponse(status, code, {}, relay.budgetHeader);
}

/** The upstream call failed or timed out with an unknown outcome: charged at the reservation. */
function failAfterCharge(relay: Relay, timedOut: boolean, a: number): Response {
  return endWithError(relay, {
    final: 'settled',
    charge: a,
    status: timedOut ? 504 : 502,
    code: timedOut ? 'upstream_timeout' : 'upstream_error',
  });
}

/** The upstream answered with an error status: refund, and open the breaker for 402/403. */
async function refuseUpstream(
  relay: Relay,
  db: Ctx['env']['DB'],
  res: Response
): Promise<Response> {
  await res.body?.cancel().catch(() => {});
  const s = res.status;
  let status = 502;
  let code: ErrorCode = 'upstream_error';
  let severity: LogEvent['severity'];
  if (s === 402 || s === 403) {
    status = 503;
    code = 'hosted_disabled';
    severity = 'high';
    try {
      await openBreaker(db, s === 402 ? 'upstream_402' : 'upstream_403');
    } catch {
      /* logged below; the refund still runs */
    }
  } else if (s === 404) {
    status = 503;
    code = 'hosted_disabled';
    severity = 'high';
  }
  return endWithError(relay, { final: 'refunded', charge: 0, status, code, severity });
}

async function relayJson(
  relay: Relay,
  res: Response,
  genHeader: string | null,
  timer: ReturnType<typeof setTimeout>,
  timedOut: () => boolean
): Promise<Response> {
  let text: string;
  try {
    text = await res.text();
  } catch {
    clearTimeout(timer);
    const status = timedOut() ? 504 : 502;
    const code = timedOut() ? 'upstream_timeout' : 'upstream_error';
    relay.ctx.exec.waitUntil(
      settleAndLog(relay, { costUsd: null, generationIds: [genHeader] }, { status, code })
    );
    return errorResponse(status, code, {}, relay.budgetHeader);
  }
  clearTimeout(timer);
  const usage = parseJsonUsage(text, relay.gateway.readUsage);
  relay.ctx.exec.waitUntil(
    settleAndLog(
      relay,
      {
        costUsd: usage.costUsd,
        generationIds: [genHeader ?? usage.id],
      },
      { status: 200, tokens: tokensOf(usage) }
    )
  );
  return new Response(text, {
    status: 200,
    headers: { 'content-type': 'application/json', ...relay.budgetHeader },
  });
}

/** Relays every byte, keeps a 2 KB tail, and settles when the stream ends however it ends. */
function relayStream(
  relay: Relay,
  res: Response,
  genHeader: string | null,
  ac: AbortController
): Response {
  const body = res.body;
  if (!body) {
    return endWithError(relay, {
      final: 'settled',
      charge: relay.r,
      status: 502,
      code: 'upstream_error',
    });
  }
  const tail = new TailBuffer();
  const ts = new TransformStream<Uint8Array, Uint8Array>();
  const writer = ts.writable.getWriter();
  const reader = body.getReader();
  let ended: 'end' | 'error' | 'idle' | 'cancel' | null = null;
  const IDLE = Symbol('idle');
  writer.closed.catch(() => {
    if (ended === null) {
      ended = 'cancel';
      ac.abort();
    }
  });

  const readIdle = async () => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, rej) => {
      t = setTimeout(() => rej(IDLE), TIMEOUTS.streamIdleMs);
    });
    const readP = reader.read();
    readP.catch(() => {});
    try {
      return await Promise.race([readP, timeout]);
    } finally {
      clearTimeout(t);
    }
  };

  const pump = (async () => {
    try {
      for (;;) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await readIdle();
        } catch (e) {
          if (ended === null) ended = e === IDLE ? 'idle' : 'error';
          throw e;
        }
        if (chunk.done) break;
        tail.push(chunk.value);
        try {
          await writer.write(chunk.value);
        } catch (e) {
          if (ended === null) ended = 'cancel';
          throw e;
        }
      }
      if (ended === null) ended = 'end';
      await writer.close().catch(() => {});
    } catch {
      ac.abort();
      await reader.cancel().catch(() => {});
      await writer.abort(new Error('upstream_stream_failed')).catch(() => {});
    }
    const t = parseTail(tail.text(), relay.gateway.readUsage);
    await settleAndLog(
      relay,
      {
        costUsd: t.costUsd,
        generationIds: [genHeader ?? tail.generationId()],
      },
      {
        status: 200,
        code:
          ended === 'end' && !t.error
            ? undefined
            : `stream_${ended ?? 'end'}${t.error ? '_error' : ''}`,
        tokens: tokensOf(t),
      }
    );
  })();
  relay.ctx.exec.waitUntil(pump);

  return new Response(ts.readable, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      ...relay.budgetHeader,
    },
  });
}
