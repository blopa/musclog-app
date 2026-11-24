// Which gateway serves Iron chat requests: the D1 `meta` row `upstream` ('openrouter' | 'otari'),
// flipped by hand (docs/PREMIUM_WORKER.md). Read at most every CACHE_MS per isolate per DB. Anything
// that is not a clean 'otari' on a fully configured Worker means OpenRouter, so a bad toggle never
// breaks serving and never sends a request somewhere it was not set up for.
import type { OtariConfig } from '../config';
import type { Ctx } from '../context';
import type { AllowlistedRequest } from '../proxy/allowlist';
import { reservationBound } from '../proxy/bound';
import { openRouterUsage, otariUsage, type UsageReader } from '../proxy/sse';
import {
  assertOtariPinned,
  buildOpenRouterBody,
  buildOtariBody,
  selectorProvider,
} from '../proxy/upstreamBody';
import type { OtariClient, UpstreamName } from './types';

export const UPSTREAM_CACHE_MS = 30_000;
const UPSTREAM_META_KEY = 'upstream';
const GENERATION_TRIES = 3;

/** USD -> whole micro-USD, rounded up. The 1e9 detour removes float noise (0.00123 * 1e6). */
export const costToMicro = (usd: number): number => Math.ceil(Math.round(usd * 1e9) / 1e3);

export interface Gateway {
  readonly name: UpstreamName;
  readonly requiresConsent: boolean;
  readonly shouldRecheckZdr: boolean;
  readonly readUsage: UsageReader;
  reservationBound(req: AllowlistedRequest): number;
  buildBody(req: AllowlistedRequest): Record<string, unknown>;
  chatCompletions(body: string, init: { signal: AbortSignal }): Promise<Response>;
  verifyResponse(
    res: Response,
    upstreamBody: Record<string, unknown>
  ): { unexpectedProvider: boolean; unverifiedCode?: 'otari_provider_unverified' };
  generationHeader(res: Response): string | null;
  lookupCost(id: string | null): Promise<number | null>;
}

interface CachedToggle {
  at: number;
  raw: string | null;
  misconfigLogged: boolean;
}

let cache = new WeakMap<D1Database, Map<string, CachedToggle>>();

/** Tests (and nothing else) clear the per-isolate cache. */
export function resetUpstreamCache(): void {
  cache = new WeakMap();
}

async function readToggle(ctx: Ctx): Promise<CachedToggle | null> {
  const now = ctx.deps.now();
  const db = ctx.env.DB;
  let byKey = cache.get(db);
  const hit = byKey?.get(UPSTREAM_META_KEY);
  if (hit && now - hit.at >= 0 && now - hit.at < UPSTREAM_CACHE_MS) return hit;

  let row: { value: string } | null;
  try {
    row = await db
      .prepare("SELECT value FROM meta WHERE key = 'upstream'")
      .first<{ value: string }>();
  } catch {
    return null; // not cached: the next call tries again
  }

  const entry: CachedToggle = { at: now, raw: row?.value ?? null, misconfigLogged: false };
  if (!byKey) {
    byKey = new Map();
    cache.set(db, byKey);
  }
  byKey.set(UPSTREAM_META_KEY, entry);
  return entry;
}

/** The generation's real cost from OpenRouter (retried with backoff), or null. */
async function lookupGenerationCost(ctx: Ctx, id: string | null): Promise<number | null> {
  if (!id) return null;
  for (let i = 0; i < GENERATION_TRIES; i++) {
    try {
      const g = await ctx.deps.openrouter.getGeneration(id);
      if (g && Number.isFinite(g.total_cost) && g.total_cost >= 0) return costToMicro(g.total_cost);
    } catch {
      /* retry */
    }
    if (i < GENERATION_TRIES - 1) await ctx.deps.sleep(1000 * 2 ** i);
  }
  return null;
}

function openRouterGateway(ctx: Ctx): Gateway {
  return {
    name: 'openrouter',
    requiresConsent: false,
    shouldRecheckZdr: true,
    readUsage: openRouterUsage,
    reservationBound: (req) => reservationBound(req, ctx.config, 'openrouter'),
    buildBody: (req) => buildOpenRouterBody(req.neutral, ctx.config),
    chatCompletions: (body, init) => ctx.deps.openrouter.chatCompletions(body, init),
    verifyResponse: () => ({ unexpectedProvider: false }),
    generationHeader: (res) => res.headers.get('x-generation-id'),
    lookupCost: (id) => lookupGenerationCost(ctx, id),
  };
}

function otariGateway(ctx: Ctx, otari: OtariConfig, client: OtariClient): Gateway {
  return {
    name: 'otari',
    requiresConsent: true,
    shouldRecheckZdr: false,
    readUsage: otariUsage,
    reservationBound: (req) => reservationBound(req, ctx.config, 'otari'),
    buildBody(req) {
      const body = buildOtariBody(req.neutral, otari, req.feature, ctx.env.WORKER_ENV);
      assertOtariPinned(body, otari);
      return body;
    },
    chatCompletions: (body, init) => client.chatCompletions(body, init),
    verifyResponse(res, upstreamBody) {
      // The selector pins one provider and never falls back; this checks Otari kept to it.
      const served = res.headers.get('otari-provider');
      const pinned = selectorProvider(upstreamBody.model);
      const unexpectedProvider =
        (served !== null && served.toLowerCase() !== pinned) ||
        res.headers.get('otari-fallback')?.toLowerCase() === 'true';
      return served === null
        ? { unexpectedProvider, unverifiedCode: 'otari_provider_unverified' }
        : { unexpectedProvider };
    },
    generationHeader: () => null,
    lookupCost: async () => null,
  };
}

export async function selectGateway(ctx: Ctx): Promise<Gateway> {
  const entry = await readToggle(ctx);
  if (entry?.raw === 'otari') {
    if (ctx.config.otari && ctx.env.OTARI_API_KEY && ctx.deps.otari) {
      return otariGateway(ctx, ctx.config.otari, ctx.deps.otari);
    }
    if (!entry.misconfigLogged) {
      entry.misconfigLogged = true;
      ctx.deps.log.log({
        route: 'upstream',
        status: 500,
        code: 'upstream_misconfigured',
        severity: 'high',
        upstream: 'openrouter',
      });
    }
  }
  return openRouterGateway(ctx);
}

export async function activeUpstream(ctx: Ctx): Promise<UpstreamName> {
  return (await selectGateway(ctx)).name;
}
