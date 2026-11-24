// Which gateway serves Iron chat requests: the D1 `meta` row `upstream` ('openrouter' | 'otari'),
// flipped by hand (docs/PREMIUM_WORKER.md). Read at most every CACHE_MS per isolate. Anything that
// is not a clean 'otari' on a fully configured Worker means OpenRouter, so a bad toggle never breaks
// serving and never sends a request somewhere it was not set up for.
import type { Ctx } from '../context';
import type { UpstreamName } from './types';

export const UPSTREAM_CACHE_MS = 30_000;

let cache: { at: number; value: UpstreamName } | null = null;

/** Tests (and nothing else) clear the per-isolate cache. */
export function resetUpstreamCache(): void {
  cache = null;
}

export async function activeUpstream(ctx: Ctx): Promise<UpstreamName> {
  const now = ctx.deps.now();
  if (cache && now - cache.at >= 0 && now - cache.at < UPSTREAM_CACHE_MS) return cache.value;

  let row: { value: string } | null;
  try {
    row = await ctx.env.DB.prepare("SELECT value FROM meta WHERE key = 'upstream'").first<{
      value: string;
    }>();
  } catch {
    return 'openrouter'; // not cached: the next call tries again
  }

  let value: UpstreamName = 'openrouter';
  if (row?.value === 'otari') {
    if (ctx.config.otari && ctx.env.OTARI_API_KEY && ctx.deps.otari) {
      value = 'otari';
    } else {
      ctx.deps.log.log({
        route: 'upstream',
        status: 500,
        code: 'upstream_misconfigured',
        severity: 'high',
        upstream: 'openrouter',
      });
    }
  }
  cache = { at: now, value };
  return value;
}
