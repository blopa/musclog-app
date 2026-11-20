import {
  deriveRcId,
  generateDeviceKey,
  signDeviceMessage,
  verifyDeviceSignature,
} from '@/utils/premium/deviceKeyCrypto';
import type { FetchLike } from '@/utils/premium/hostedClient';
import {
  enrollDevice,
  enrollWithRetry,
  ENROLL_RETRY_DELAYS_MS,
  type FlowDeps,
  mintSession,
  type Signer,
} from '@/utils/premium/premiumFlows';

type Init = { method?: string; headers?: Record<string, string>; body?: string };
type Reply = { status: number; body: unknown };
type Call = { method: string; path: string; init?: Init };

const BASE = 'https://ai.test';
const SESSION_TOKEN = 'SECRET-SESSION-TOKEN-7731';

const key = generateDeviceKey(new Uint8Array(48).fill(9));
const RC_ID = deriveRcId(key.publicKey);

const GRANT_BODY = {
  session_token: SESSION_TOKEN,
  expires_at: '2026-12-01T00:00:00.000Z',
  period: { used_pct: 10, resets_at: '2026-12-15T00:00:00.000Z' },
  devices: { count: 1, max: 3 },
};

function reply(status: number, body: unknown): Reply {
  return { status, body };
}

/** A fake fetch that routes by method and path and records every call. */
function makeFetch(handle: (call: Call) => Reply) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call: Call = {
      method: init?.method ?? 'GET',
      path: new URL(url).pathname,
      init,
    };
    calls.push(call);

    const r = handle(call);

    return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body };
  };

  return { fetch, calls };
}

function realSigner() {
  const sign = jest.fn<ReturnType<Signer>, Parameters<Signer>>(async (purpose, nonce) => ({
    rcId: RC_ID,
    publicKey: key.publicKey,
    signature: signDeviceMessage(key.secretKey, purpose, RC_ID, nonce),
  }));

  return sign as jest.Mock<ReturnType<Signer>, Parameters<Signer>> & Signer;
}

/** Issues a fresh nonce per challenge and answers enroll/session with the given replies. */
function workerRoutes(opts: {
  challenge?: () => Reply;
  enroll?: (call: Call) => Reply;
  session?: (call: Call) => Reply;
}) {
  let counter = 0;

  return (call: Call): Reply => {
    if (call.method === 'GET' && call.path === '/v1/challenge') {
      return opts.challenge ? opts.challenge() : reply(200, { nonce: `nonce-${(counter += 1)}` });
    }

    if (call.path === '/v1/enroll') {
      return opts.enroll ? opts.enroll(call) : reply(200, GRANT_BODY);
    }

    if (call.path === '/v1/session') {
      return opts.session ? opts.session(call) : reply(200, GRANT_BODY);
    }

    return reply(404, { error: { code: 'invalid_request' } });
  };
}

function deps(fetch: FetchLike, sign: Signer): FlowDeps {
  return { baseUrl: BASE, fetch, sign };
}

function bodyOf(call: Call): Record<string, string> {
  return JSON.parse(call.init?.body ?? '{}') as Record<string, string>;
}

describe('enrollDevice', () => {
  it('fetches a challenge, then posts a signed enroll that verifies against the nonce', async () => {
    const { fetch, calls } = makeFetch(workerRoutes({}));
    const sign = realSigner();

    const result = await enrollDevice(deps(fetch, sign));

    expect(result.ok).toBe(true);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /v1/challenge',
      'POST /v1/enroll',
    ]);

    const body = bodyOf(calls[1]);
    expect(body.rc_id).toBe(RC_ID);
    expect(body.nonce).toBe('nonce-1');
    expect(sign).toHaveBeenCalledWith('enroll', 'nonce-1');

    const publicKey = new Uint8Array(Buffer.from(body.public_key, 'base64url'));
    const signature = new Uint8Array(Buffer.from(body.signature, 'base64url'));

    expect(publicKey).toEqual(key.publicKey);
    expect(verifyDeviceSignature(publicKey, 'enroll', body.rc_id, body.nonce, signature)).toBe(
      true
    );
  });

  it('returns the parsed grant on success', async () => {
    const { fetch } = makeFetch(workerRoutes({}));

    const result = await enrollDevice(deps(fetch, realSigner()));

    expect(result).toEqual({
      ok: true,
      value: {
        sessionToken: SESSION_TOKEN,
        expiresAtMs: Date.parse('2026-12-01T00:00:00.000Z'),
        usedPct: 10,
        resetsAt: '2026-12-15T00:00:00.000Z',
        devices: { count: 1, max: 3 },
      },
    });
  });

  it('issues a new challenge and a new nonce on every attempt', async () => {
    const { fetch, calls } = makeFetch(workerRoutes({}));

    await enrollDevice(deps(fetch, realSigner()));
    await enrollDevice(deps(fetch, realSigner()));

    const challenges = calls.filter((c) => c.path === '/v1/challenge');
    const enrolls = calls.filter((c) => c.path === '/v1/enroll');

    expect(challenges).toHaveLength(2);
    expect(enrolls.map((c) => bodyOf(c).nonce)).toEqual(['nonce-1', 'nonce-2']);
  });

  it('fails with the challenge failure and never signs when the challenge is refused', async () => {
    const { fetch, calls } = makeFetch(
      workerRoutes({ challenge: () => reply(503, { error: { code: 'whatever' } }) })
    );
    const sign = realSigner();

    const result = await enrollDevice(deps(fetch, sign));

    expect(result).toEqual({ ok: false, failure: 'unavailable', status: 503 });
    expect(sign).not.toHaveBeenCalled();
    expect(calls.some((c) => c.path === '/v1/enroll')).toBe(false);
  });

  it.each([
    ['no nonce field', {}],
    ['an empty nonce', { nonce: '' }],
    ['a non-string nonce', { nonce: 42 }],
  ])('fails as invalid_response without signing when the challenge has %s', async (_l, body) => {
    const { fetch, calls } = makeFetch(workerRoutes({ challenge: () => reply(200, body) }));
    const sign = realSigner();

    const result = await enrollDevice(deps(fetch, sign));

    expect(result).toEqual({ ok: false, failure: 'invalid_response', status: 200 });
    expect(sign).not.toHaveBeenCalled();
    expect(calls.some((c) => c.path === '/v1/enroll')).toBe(false);
  });

  it('reports invalid_response for a malformed grant', async () => {
    const { fetch } = makeFetch(
      workerRoutes({ enroll: () => reply(200, { ...GRANT_BODY, devices: { count: 9, max: 3 } }) })
    );

    expect(await enrollDevice(deps(fetch, realSigner()))).toEqual({
      ok: false,
      failure: 'invalid_response',
      status: 200,
    });
  });

  it('maps a Worker error code to its failure kind', async () => {
    const { fetch } = makeFetch(
      workerRoutes({
        enroll: () => reply(403, { error: { code: 'subscription_required' } }),
      })
    );

    expect(await enrollDevice(deps(fetch, realSigner()))).toEqual({
      ok: false,
      failure: 'subscription_required',
      status: 403,
    });
  });
});

describe('mintSession', () => {
  it('signs a session purpose and returns the grant', async () => {
    const { fetch, calls } = makeFetch(workerRoutes({}));
    const sign = realSigner();

    const result = await mintSession(deps(fetch, sign));

    expect(result.ok).toBe(true);
    expect(sign).toHaveBeenCalledWith('session', 'nonce-1');

    const body = bodyOf(calls[1]);
    expect(calls[1].path).toBe('/v1/session');
    expect(body).not.toHaveProperty('public_key');

    const signature = new Uint8Array(Buffer.from(body.signature, 'base64url'));

    expect(verifyDeviceSignature(key.publicKey, 'session', RC_ID, 'nonce-1', signature)).toBe(true);
  });

  it('reports invalid_response for a malformed session grant', async () => {
    const { fetch } = makeFetch(
      workerRoutes({ session: () => reply(200, { ...GRANT_BODY, session_token: '' }) })
    );

    expect(await mintSession(deps(fetch, realSigner()))).toEqual({
      ok: false,
      failure: 'invalid_response',
      status: 200,
    });
  });

  it('never puts the session token into a failure', async () => {
    const { fetch } = makeFetch(
      workerRoutes({
        session: () => reply(200, { ...GRANT_BODY, period: { used_pct: 500, resets_at: 'x' } }),
      })
    );

    const result = await mintSession(deps(fetch, realSigner()));

    expect(JSON.stringify(result)).not.toContain(SESSION_TOKEN);
  });

  it('keeps the session token out of a failure from a 401 body that echoes it', async () => {
    const { fetch } = makeFetch(
      workerRoutes({
        session: () =>
          reply(401, {
            error: { code: 'unknown_device', message: SESSION_TOKEN },
            session_token: SESSION_TOKEN,
          }),
      })
    );

    const result = await mintSession(deps(fetch, realSigner()));

    expect(result).toEqual({ ok: false, failure: 'unknown_device', status: 401 });
    expect(JSON.stringify(result)).not.toContain(SESSION_TOKEN);
  });

  it('keeps the token out of a network failure message', async () => {
    const fetch: FetchLike = async (url) => {
      if (url.endsWith('/v1/challenge')) {
        return { status: 200, ok: true, json: async () => ({ nonce: 'n' }) };
      }

      throw new Error(`socket closed while sending ${SESSION_TOKEN}`);
    };

    const result = await mintSession(deps(fetch, realSigner()));

    expect(result).toEqual({ ok: false, failure: 'network', status: 0 });
    expect(JSON.stringify(result)).not.toContain(SESSION_TOKEN);
  });
});

describe('enrollWithRetry', () => {
  function lagThenSucceed(lagAttempts: number, code = 'subscription_required') {
    let attempt = 0;

    return workerRoutes({
      enroll: () => {
        attempt += 1;

        return attempt <= lagAttempts ? reply(409, { error: { code } }) : reply(200, GRANT_BODY);
      },
    });
  }

  it('retries subscription_required with 2s, 4s and 8s waits and stops on the first success', async () => {
    const sleep = jest.fn(async () => undefined);
    const { fetch, calls } = makeFetch(lagThenSucceed(3));

    const result = await enrollWithRetry({ ...deps(fetch, realSigner()), sleep });

    expect(result.ok).toBe(true);
    expect(sleep.mock.calls).toEqual([[2000], [4000], [8000]]);
    expect(calls.filter((c) => c.path === '/v1/enroll')).toHaveLength(4);
    expect(ENROLL_RETRY_DELAYS_MS).toEqual([2000, 4000, 8000]);
  });

  it('stops retrying as soon as an attempt succeeds', async () => {
    const sleep = jest.fn(async () => undefined);
    const { fetch, calls } = makeFetch(lagThenSucceed(1));

    const result = await enrollWithRetry({ ...deps(fetch, realSigner()), sleep });

    expect(result.ok).toBe(true);
    expect(sleep.mock.calls).toEqual([[2000]]);
    expect(calls.filter((c) => c.path === '/v1/enroll')).toHaveLength(2);
  });

  it('also retries entitlement_unavailable', async () => {
    const sleep = jest.fn(async () => undefined);
    const { fetch } = makeFetch(lagThenSucceed(1, 'entitlement_unavailable'));

    const result = await enrollWithRetry({ ...deps(fetch, realSigner()), sleep });

    expect(result.ok).toBe(true);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('gives up after four attempts and returns the last lag failure', async () => {
    const sleep = jest.fn(async () => undefined);
    const { fetch, calls } = makeFetch(lagThenSucceed(99));

    const result = await enrollWithRetry({ ...deps(fetch, realSigner()), sleep });

    expect(result).toEqual({ ok: false, failure: 'subscription_required', status: 409 });
    expect(calls.filter((c) => c.path === '/v1/enroll')).toHaveLength(4);
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it('asks for a fresh nonce on every retry', async () => {
    const sleep = jest.fn(async () => undefined);
    const { fetch, calls } = makeFetch(lagThenSucceed(2));

    await enrollWithRetry({ ...deps(fetch, realSigner()), sleep });

    const nonces = calls.filter((c) => c.path === '/v1/enroll').map((c) => bodyOf(c).nonce);

    expect(new Set(nonces).size).toBe(3);
  });

  it.each([
    ['unauthorized', 401],
    ['bad_signature', 401],
    ['unknown_device', 401],
    ['revenue_unverified', 403],
  ])('does not retry or sleep on %s', async (code, status) => {
    const sleep = jest.fn(async () => undefined);
    const { fetch, calls } = makeFetch(
      workerRoutes({ enroll: () => reply(status, { error: { code } }) })
    );

    const result = await enrollWithRetry({ ...deps(fetch, realSigner()), sleep });

    expect(result).toEqual({ ok: false, failure: code, status });
    expect(calls.filter((c) => c.path === '/v1/enroll')).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('honours custom delays', async () => {
    const sleep = jest.fn(async () => undefined);
    const { fetch, calls } = makeFetch(lagThenSucceed(99));

    const result = await enrollWithRetry({
      ...deps(fetch, realSigner()),
      sleep,
      delaysMs: [10, 20],
    });

    expect(result.ok).toBe(false);
    expect(sleep.mock.calls).toEqual([[10], [20]]);
    expect(calls.filter((c) => c.path === '/v1/enroll')).toHaveLength(3);
  });

  it('never leaks the session token through its final failure', async () => {
    const sleep = jest.fn(async () => undefined);
    const { fetch } = makeFetch(
      workerRoutes({
        enroll: () =>
          reply(409, { error: { code: 'subscription_required' }, session_token: SESSION_TOKEN }),
      })
    );

    const result = await enrollWithRetry({ ...deps(fetch, realSigner()), sleep });

    expect(JSON.stringify(result)).not.toContain(SESSION_TOKEN);
  });
});
