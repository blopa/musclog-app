// Challenge -> sign -> enroll / session, with everything injected (fetch, signer, sleep) so tests
// can run the real Worker handlers through the real signing path (plan 6.1, 13). Pure; relative
// imports only because the Worker's own tests load this file.
import {
  type FetchLike,
  hostedChallenge,
  hostedEnroll,
  type HostedResult,
  hostedSession,
} from './hostedClient';
import {
  failureKindOf,
  isEntitlementLag,
  parseSessionGrant,
  type PremiumFailureKind,
  type SessionGrant,
} from './premiumState';

export type SignedMessage = { rcId: string; publicKey: Uint8Array; signature: Uint8Array };
export type Signer = (purpose: 'enroll' | 'session', nonce: string) => Promise<SignedMessage>;

export type FlowDeps = { baseUrl: string; fetch: FetchLike; sign: Signer };
export type FlowResult<T> =
  { ok: true; value: T } | { ok: false; failure: PremiumFailureKind; status: number };

/** Waits after an entitlement-lag failure: 2 s, 4 s, 8 s (3 retries, 4 attempts in all). */
export const ENROLL_RETRY_DELAYS_MS = [2000, 4000, 8000] as const;

function fail(result: HostedResult): { ok: false; failure: PremiumFailureKind; status: number } {
  return { ok: false, failure: failureKindOf(result), status: result.status };
}

async function freshNonce(
  deps: FlowDeps
): Promise<{ ok: true; nonce: string } | ReturnType<typeof fail>> {
  const challenge = await hostedChallenge(deps.baseUrl, deps.fetch);

  if (!challenge.ok) {
    return fail(challenge);
  }

  const nonce = (challenge.body as { nonce?: unknown } | null)?.nonce;

  if (typeof nonce !== 'string' || nonce.length === 0) {
    return { ok: false, failure: 'invalid_response', status: challenge.status };
  }

  return { ok: true, nonce };
}

function grantFrom(result: HostedResult): FlowResult<SessionGrant> {
  if (!result.ok) {
    return fail(result);
  }

  const grant = parseSessionGrant(result.body);

  return grant
    ? { ok: true, value: grant }
    : { ok: false, failure: 'invalid_response', status: result.status };
}

/** One attempt. A new nonce every time: the Worker accepts each nonce once. */
export async function enrollDevice(deps: FlowDeps): Promise<FlowResult<SessionGrant>> {
  const challenge = await freshNonce(deps);

  if (!challenge.ok) {
    return challenge;
  }

  const signed = await deps.sign('enroll', challenge.nonce);

  return grantFrom(
    await hostedEnroll(
      deps.baseUrl,
      {
        rcId: signed.rcId,
        publicKey: signed.publicKey,
        nonce: challenge.nonce,
        signature: signed.signature,
      },
      deps.fetch
    )
  );
}

export async function mintSession(deps: FlowDeps): Promise<FlowResult<SessionGrant>> {
  const challenge = await freshNonce(deps);

  if (!challenge.ok) {
    return challenge;
  }

  const signed = await deps.sign('session', challenge.nonce);

  return grantFrom(
    await hostedSession(
      deps.baseUrl,
      { rcId: signed.rcId, nonce: challenge.nonce, signature: signed.signature },
      deps.fetch
    )
  );
}

/**
 * Enroll right after a purchase or restore. RevenueCat's v2 API can lag, so an entitlement-lag
 * failure is retried (3 times, `ENROLL_RETRY_DELAYS_MS`); any other failure ends it at once.
 */
export async function enrollWithRetry(
  deps: FlowDeps & {
    sleep: (ms: number) => Promise<void>;
    delaysMs?: readonly number[];
    /** Called before every attempt (the first and each retry), so a screen can say what is happening. */
    onProgress?: (stage: 'confirming') => void;
  }
): Promise<FlowResult<SessionGrant>> {
  const delays = deps.delaysMs ?? ENROLL_RETRY_DELAYS_MS;
  deps.onProgress?.('confirming');
  let result = await enrollDevice(deps);

  for (const delay of delays) {
    if (result.ok || !isEntitlementLag(result.failure)) {
      return result;
    }

    await deps.sleep(delay);
    deps.onProgress?.('confirming');
    result = await enrollDevice(deps);
  }

  return result;
}
