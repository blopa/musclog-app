import type { Ctx } from '../context';
import { logged } from '../identity/devices';
import { mintNonce } from '../identity/nonce';
import { jsonResponse } from '../http';
import { enforceRateLimit, limiterAddress } from '../limiter';

/** GET /v1/challenge: a stateless, timestamped HMAC nonce. No D1 access. */
export async function handleChallenge(request: Request, ctx: Ctx): Promise<Response> {
  return logged(ctx, '/v1/challenge', async () => {
    // The address is only the limiter's key: never stored or logged.
    const ip = limiterAddress(request, ctx);
    await enforceRateLimit(ctx, 'challenge:' + ip, 10);
    return jsonResponse({ nonce: await mintNonce(ctx) });
  });
}
