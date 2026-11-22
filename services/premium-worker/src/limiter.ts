// Rate limiting (Workers Rate Limiting binding `RATE_LIMITER`, declared per environment in
// wrangler.toml). Optional only where nothing public can reach the Worker (`local`, `test`):
// in `production` and `staging` a missing binding fails closed instead of silently serving
// unthrottled, because /v1/challenge is unauthenticated and every /v1/enroll costs RevenueCat calls.
import type { Ctx } from './context';
import { ApiError } from './http';

const REQUIRED_IN = ['production', 'staging'];

/** Throws 429 `busy` when `key` is over its limit; 503 `hosted_disabled` when the binding is missing where required. */
export async function enforceRateLimit(ctx: Ctx, key: string, retryAfter: number): Promise<void> {
  const limiter = ctx.env.RATE_LIMITER;
  if (!limiter) {
    if (REQUIRED_IN.includes(ctx.env.WORKER_ENV)) {
      ctx.deps.log.log({
        route: 'rate_limiter',
        status: 503,
        code: 'hosted_disabled',
        severity: 'high',
      });
      throw new ApiError(503, 'hosted_disabled');
    }
    return;
  }
  const { success } = await limiter.limit({ key });
  if (!success) throw new ApiError(429, 'busy', { retry_after: retryAfter });
}

/**
 * The caller's address, only ever used as a limiter key (never stored or logged). Where the
 * limiter is required the Cloudflare header must be present: a shared fallback bucket would let
 * one caller exhaust everyone's allowance, so a request without it is refused.
 */
export function limiterAddress(request: Request, ctx: Ctx): string {
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) return ip;
  if (REQUIRED_IN.includes(ctx.env.WORKER_ENV)) throw new ApiError(400, 'invalid_request');
  return 'unknown';
}
