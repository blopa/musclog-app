import type { Ctx } from '../context';
import { logged } from '../identity/devices';
import { mintNonce } from '../identity/nonce';
import { ApiError, jsonResponse } from '../http';

/** GET /v1/challenge: a stateless, timestamped HMAC nonce. No D1 access. */
export async function handleChallenge(request: Request, ctx: Ctx): Promise<Response> {
  return logged(ctx, '/v1/challenge', async () => {
    const limiter = ctx.env.RATE_LIMITER;
    if (limiter) {
      // The address is only the limiter's key: never stored or logged.
      const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
      const { success } = await limiter.limit({ key: 'challenge:' + ip });
      if (!success) throw new ApiError(429, 'busy', { retry_after: 10 });
    }
    return jsonResponse({ nonce: await mintNonce(ctx) });
  });
}
