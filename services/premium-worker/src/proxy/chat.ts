// POST /v1/chat/completions (plan 8.2): the hot path. Order: token, idempotency key, rate limit,
// body cap, allowlist, period, reserve, upstream, settle. Settlement always runs in waitUntil so
// a client disconnect cannot skip it; an unknown outcome is charged at the reservation (fail closed).
import { isBreakerOpen, openBreaker } from '../breaker';
import type { Ctx } from '../context';
import { dayKey } from '../db';
import { effectiveCap } from '../finance';
import {
  ApiError,
  errorResponse,
  isoTime,
  readBodyCapped,
  type ErrorCode,
  type ErrorExtra,
} from '../http';
import { bearerToken, verifySessionToken } from '../identity/token';
import {
  findLivePeriod,
  reserve,
  settleWithOverrun,
  type PeriodRow,
  type ReserveOutcome,
} from '../ledger';
import { lineagePrefix, type LogEvent } from '../log';
import { reverifySubscription } from '../billing/periods';
import { RevenueCatUnavailableError } from '../upstream/types';
import { allowlistRequest } from './allowlist';
import { reservationBound } from './bound';
import { parseJsonUsage, parseTail, TailBuffer } from './sse';

/** Patchable by tests so none of them waits 30 s. */
export const TIMEOUTS = { overallMs: 55_000, streamIdleMs: 30_000 };

const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;
const DAY_MS = 86_400_000;
const GENERATION_TRIES = 3;
const te = new TextEncoder();

async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(text)));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** USD -> whole micro-USD, rounded up. The 1e9 detour removes float noise (0.00123 * 1e6). */
export const costToMicro = (usd: number): number => Math.ceil(Math.round(usd * 1e9) / 1e3);

const budgetPct = (p: PeriodRow, r: number, now: number): number => {
  const cap = effectiveCap(p, now);
  const left = (cap - p.spent_u - p.reserved_u - r) / cap;
  return Math.min(100, Math.max(0, Math.floor(left * 100)));
};
const usedPct = (p: PeriodRow, now: number): number => {
  const cap = effectiveCap(p, now);
  return Math.min(100, Math.max(0, Math.floor(((p.spent_u + p.reserved_u) / cap) * 100)));
};

interface RequestLog {
  lineage?: string;
  model?: string;
}

export async function handleChatCompletions(request: Request, ctx: Ctx): Promise<Response> {
  const started = ctx.deps.now();
  const rl: RequestLog = {};
  const emit = (e: Omit<LogEvent, 'route' | 'latency_ms' | 'lineage_prefix' | 'model'>) =>
    ctx.deps.log.log({
      route: '/v1/chat/completions',
      latency_ms: ctx.deps.now() - started,
      lineage_prefix: rl.lineage,
      model: rl.model,
      ...e,
    });
  try {
    return await run(request, ctx, rl, emit);
  } catch (e) {
    if (e instanceof ApiError) emit({ status: e.status, code: e.code });
    throw e;
  }
}

async function run(
  request: Request,
  ctx: Ctx,
  rl: RequestLog,
  emit: (e: Omit<LogEvent, 'route' | 'latency_ms' | 'lineage_prefix' | 'model'>) => void
): Promise<Response> {
  const { env, config, deps } = ctx;
  const db = env.DB;
  const now = deps.now();

  // 1. Session token.
  const token = bearerToken(request);
  const claims = token
    ? await verifySessionToken([env.SESSION_HMAC_KEY, env.SESSION_HMAC_KEY_PREVIOUS], token, now)
    : null;
  if (!claims) throw new ApiError(401, 'unauthorized');

  // 2. Idempotency-Key.
  const idemKey = request.headers.get('idempotency-key');
  if (!idemKey || !KEY_RE.test(idemKey))
    throw new ApiError(400, 'invalid_request', { path: 'header.Idempotency-Key' });

  // 3. Optional rate limiter.
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: 'chat:' + claims.rc });
    if (!success) throw new ApiError(429, 'busy', { retry_after: 2 });
  }

  // 4. Body cap before any D1 work, then the allowlist and the reservation bound.
  const raw = await readBodyCapped(request, config.limits.body_max_bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new ApiError(400, 'invalid_request', { path: 'body' });
  }
  const req = allowlistRequest(parsed, config);
  const r = reservationBound(req, config);
  rl.model = config.model;

  // 5. The caller's live period, diagnosing why there is none.
  let period = await findLivePeriod(db, claims.rc, now);
  if (!period) {
    if (await isBreakerOpen(db)) throw new ApiError(503, 'hosted_disabled');
    const df = await db
      .prepare("SELECT value FROM meta WHERE key = 'daily_full'")
      .first<{ value: string }>();
    if (df?.value === '1') throw new ApiError(503, 'daily_full');
    const dev = await db
      .prepare("SELECT lineage_key FROM devices WHERE rc_id = ?1 AND status = 'active'")
      .bind(claims.rc)
      .first<{ lineage_key: string }>();
    if (!dev) throw new ApiError(401, 'unknown_device');
    const latest = await db
      .prepare(
        'SELECT rc_subscription_id FROM periods WHERE lineage_key = ?1 ORDER BY period_start DESC LIMIT 1'
      )
      .bind(dev.lineage_key)
      .first<{ rc_subscription_id: string }>();
    if (!latest) throw new ApiError(403, 'subscription_required');
    try {
      const v = await reverifySubscription(ctx, latest.rc_subscription_id, now);
      if (v.status === 'lapsed') throw new ApiError(403, 'subscription_required');
    } catch (e) {
      if (e instanceof RevenueCatUnavailableError)
        throw new ApiError(503, 'entitlement_unavailable');
      throw e;
    }
    period = await findLivePeriod(db, claims.rc, now);
    if (!period) throw new ApiError(403, 'subscription_required');
  }
  rl.lineage = lineagePrefix(period.lineage_key);
  const pk = period.payment_key;
  const pct = budgetPct(period, r, now);
  const budgetHeader = { 'x-musclog-budget-remaining-pct': String(pct) };
  const fail = (
    status: number,
    code: ErrorCode,
    extra: ErrorExtra = {},
    log?: Partial<LogEvent>
  ) => {
    emit({ status, code, ...log });
    return errorResponse(status, code, extra, budgetHeader);
  };

  // 6. The upstream body and its hash (the Idempotency-Key is bound to it).
  const bodyText = JSON.stringify({ ...req.body, user: period.lineage_key.slice(0, 16) });
  const bh = await sha256Hex(bodyText);

  // 7. Reserve. A D1 failure fails closed, with no upstream call.
  const day = dayKey(now);
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
        day,
        maxReq: config.limits.max_requests_per_day,
        maxInflight: config.limits.max_inflight,
      })
    ).outcome;
  } catch {
    return fail(503, 'hosted_disabled', {}, { severity: 'error' });
  }
  switch (outcome) {
    case 'admitted':
      break;
    case 'in_progress':
      return fail(409, 'in_progress', { retry_after: 2 });
    case 'already_processed':
      return fail(409, 'already_processed');
    case 'idempotency_mismatch':
      return fail(422, 'idempotency_mismatch');
    case 'budget_exhausted':
      return fail(402, 'budget_exhausted', {
        used_pct: usedPct(period, now),
        resets_at: isoTime(period.period_end),
      });
    case 'daily_limit':
      return fail(402, 'daily_limit', {
        resets_at: isoTime((Math.floor(now / DAY_MS) + 1) * DAY_MS),
      });
    case 'busy':
      return fail(429, 'busy', { retry_after: 2 });
    case 'hosted_disabled':
      return fail(503, 'hosted_disabled');
    case 'daily_full':
      return fail(503, 'daily_full');
    case 'no_device':
      return fail(401, 'unknown_device');
    case 'no_period':
      return fail(403, 'subscription_required');
  }

  // 8-9. Upstream call and settlement.
  const settle = async (final: 'settled' | 'refunded', a: number) => {
    let overrun = false;
    try {
      const out = await settleWithOverrun(
        db,
        { pk, id: idemKey, final, a, now: deps.now(), day: dayKey(deps.now()) },
        r,
        config.breaker.overruns_24h
      );
      overrun = out.overrun;
    } catch {
      // The cron sweep charges r after expiry: fail closed.
      emit({ status: 500, code: 'settle_failed', severity: 'error' });
    }
    return { overrun };
  };
  const lookupCost = async (id: string | null): Promise<number | null> => {
    if (!id) return null;
    for (let i = 0; i < GENERATION_TRIES; i++) {
      try {
        const g = await deps.openrouter.getGeneration(id);
        if (g && Number.isFinite(g.total_cost) && g.total_cost >= 0)
          return costToMicro(g.total_cost);
      } catch {
        /* retry */
      }
      if (i < GENERATION_TRIES - 1) await deps.sleep(1000 * 2 ** i);
    }
    return null;
  };

  const ac = new AbortController();
  let timedOut = false;
  const timeoutMs = req.stream ? TIMEOUTS.streamIdleMs : TIMEOUTS.overallMs;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, timeoutMs);

  let res: Response;
  try {
    res = await deps.openrouter.chatCompletions(bodyText, { signal: ac.signal });
  } catch {
    clearTimeout(timer);
    // Unknown outcome: charged at the reservation.
    const status = timedOut ? 504 : 502;
    const code = timedOut ? 'upstream_timeout' : 'upstream_error';
    const done = settle('settled', r).then((s) =>
      emit({ status, code, cost_u: r, overrun: s.overrun })
    );
    ctx.exec.waitUntil(done);
    return errorResponse(status, code, {}, budgetHeader);
  }

  if (!res.ok) {
    clearTimeout(timer);
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
    ctx.exec.waitUntil(
      settle('refunded', 0).then(() => emit({ status, code, cost_u: 0, severity }))
    );
    return errorResponse(status, code, {}, budgetHeader);
  }

  const genHeader = res.headers.get('x-generation-id');

  if (!req.stream) {
    let text: string;
    try {
      text = await res.text();
    } catch {
      clearTimeout(timer);
      const status = timedOut ? 504 : 502;
      const code = timedOut ? 'upstream_timeout' : 'upstream_error';
      ctx.exec.waitUntil(
        (async () => {
          const a = (await lookupCost(genHeader)) ?? r;
          const s = await settle('settled', a);
          emit({ status, code, cost_u: a, overrun: s.overrun });
        })()
      );
      return errorResponse(status, code, {}, budgetHeader);
    }
    clearTimeout(timer);
    const usage = parseJsonUsage(text);
    ctx.exec.waitUntil(
      (async () => {
        const a =
          usage.costUsd !== null
            ? costToMicro(usage.costUsd)
            : ((await lookupCost(genHeader ?? usage.id)) ?? r);
        const s = await settle('settled', a);
        const tokens =
          usage.promptTokens !== null && usage.completionTokens !== null
            ? usage.promptTokens + usage.completionTokens
            : undefined;
        emit({ status: 200, tokens, cost_u: a, overrun: s.overrun });
      })()
    );
    return new Response(text, {
      status: 200,
      headers: { 'content-type': 'application/json', ...budgetHeader },
    });
  }

  // Streaming: relay every byte, keep a 2 KB tail, settle when the stream ends however it ends.
  clearTimeout(timer);
  const body = res.body;
  if (!body) {
    ctx.exec.waitUntil(
      settle('settled', r).then((s) =>
        emit({ status: 502, code: 'upstream_error', cost_u: r, overrun: s.overrun })
      )
    );
    return errorResponse(502, 'upstream_error', {}, budgetHeader);
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
    const t = parseTail(tail.text());
    const a =
      t.costUsd !== null
        ? costToMicro(t.costUsd)
        : ((await lookupCost(genHeader ?? tail.generationId())) ?? r);
    const s = await settle('settled', a);
    const tokens =
      t.promptTokens !== null && t.completionTokens !== null
        ? t.promptTokens + t.completionTokens
        : undefined;
    emit({
      status: 200,
      code:
        ended === 'end' && !t.error
          ? undefined
          : `stream_${ended ?? 'end'}${t.error ? '_error' : ''}`,
      tokens,
      cost_u: a,
      overrun: s.overrun,
    });
  })();
  ctx.exec.waitUntil(pump);

  return new Response(ts.readable, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      ...budgetHeader,
    },
  });
}
