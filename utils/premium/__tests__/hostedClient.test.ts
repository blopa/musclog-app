import {
  deriveRcId,
  generateDeviceKey,
  signDeviceMessage,
  verifyDeviceSignature,
} from '@/utils/premium/deviceKeyCrypto';
import {
  type FetchLike,
  hostedChallenge,
  hostedConfig,
  hostedEnroll,
  hostedSession,
  hostedUsage,
  redactTokens,
  toBase64Url,
} from '@/utils/premium/hostedClient';

type Call = {
  url: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
};

function fakeFetch(status: number, body: unknown, calls: Call[] = []): FetchLike {
  return async (url, init) => {
    calls.push({ url, init });

    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
}

function fromB64url(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64url'));
}

describe('toBase64Url', () => {
  it('matches Node base64url, unpadded', () => {
    for (const len of [0, 1, 2, 3, 4, 64, 65]) {
      const bytes = new Uint8Array(len).map((_, i) => (i * 37 + 250) % 256);

      expect(toBase64Url(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
    }
  });
});

describe('hosted requests', () => {
  it('GETs the challenge and strips a trailing slash', async () => {
    const calls: Call[] = [];
    const r = await hostedChallenge('https://w.example//', fakeFetch(200, { nonce: 'n1' }, calls));

    expect(calls[0].url).toBe('https://w.example/v1/challenge');
    expect(calls[0].init?.method).toBe('GET');
    expect(r).toMatchObject({ status: 200, ok: true, errorCode: null, body: { nonce: 'n1' } });
  });

  it('signs the challenge nonce and the enroll body carries verifiable base64url fields', async () => {
    const { secretKey, publicKey } = generateDeviceKey(new Uint8Array(48).fill(7));
    const rcId = deriveRcId(publicKey);
    const nonce = 'abc.def';
    const signature = signDeviceMessage(secretKey, 'enroll', rcId, nonce);
    const calls: Call[] = [];

    await hostedEnroll(
      'https://w.example',
      { rcId, publicKey, nonce, signature },
      fakeFetch(200, {}, calls)
    );
    const sent = JSON.parse(calls[0].init?.body ?? '{}');

    expect(calls[0].url).toBe('https://w.example/v1/enroll');
    expect(calls[0].init?.method).toBe('POST');
    expect(Object.keys(sent).sort()).toEqual(['nonce', 'public_key', 'rc_id', 'signature']);
    expect(sent.rc_id).toBe(rcId);
    expect(fromB64url(sent.public_key)).toHaveLength(65);
    expect(
      verifyDeviceSignature(
        fromB64url(sent.public_key),
        'enroll',
        sent.rc_id,
        sent.nonce,
        fromB64url(sent.signature)
      )
    ).toBe(true);
  });

  it('posts the session body without a public key', async () => {
    const calls: Call[] = [];

    await hostedSession(
      'https://w.example',
      { rcId: 'mlg1_x', nonce: 'n', signature: new Uint8Array(64) },
      fakeFetch(200, {}, calls)
    );

    expect(Object.keys(JSON.parse(calls[0].init?.body ?? '{}')).sort()).toEqual([
      'nonce',
      'rc_id',
      'signature',
    ]);
    expect(calls[0].url).toBe('https://w.example/v1/session');
  });

  it('redacts tokens but keeps the raw body', async () => {
    const body = { session_token: 'abcdefghijklmnop', nested: { token: '12345678xyz' }, n: 1 };
    const r = await hostedSession(
      'https://w',
      { rcId: 'r', nonce: 'n', signature: new Uint8Array(64) },
      fakeFetch(200, body)
    );

    expect(JSON.stringify(redactTokens(r.body))).not.toContain('abcdefghijklmnop');
    expect(redactTokens(r.body)).toEqual({
      session_token: '<token len=16 prefix=abcdefgh>',
      nested: { token: '<token len=11 prefix=12345678>' },
      n: 1,
    });
    expect(r.body).toBe(body);
  });

  it('reads the error code from the error envelope', async () => {
    const r = await hostedChallenge(
      'https://w',
      fakeFetch(401, { error: { code: 'stale_nonce', message: 'x' } })
    );

    expect(r).toMatchObject({ status: 401, ok: false, errorCode: 'stale_nonce' });
  });

  it('reports unknown for an unreadable error body', async () => {
    const f: FetchLike = async () => ({
      status: 502,
      ok: false,
      json: async () => {
        throw new Error('bad json');
      },
    });

    expect(await hostedChallenge('https://w', f)).toMatchObject({
      status: 502,
      errorCode: 'unknown',
    });
  });

  it('turns a network failure into status 0', async () => {
    const f: FetchLike = async () => {
      throw new Error('offline');
    };
    const r = await hostedChallenge('https://w', f);

    expect(r).toMatchObject({ status: 0, ok: false, errorCode: 'network' });
  });
});

describe('hosted config and usage', () => {
  it('GETs the config with no authorization header and no body', async () => {
    const calls: Call[] = [];
    const r = await hostedConfig('https://w.example//', fakeFetch(200, { tier: 'x' }, calls));

    expect(calls[0].url).toBe('https://w.example/v1/config');
    expect(calls[0].init?.method).toBe('GET');
    expect(calls[0].init?.headers?.authorization).toBeUndefined();
    expect(calls[0].init?.body).toBeUndefined();
    expect(r).toMatchObject({ status: 200, ok: true, body: { tier: 'x' } });
  });

  it('GETs usage with exactly the bearer authorization header', async () => {
    const calls: Call[] = [];
    const r = await hostedUsage('https://w.example/', 'tok_secret', fakeFetch(200, {}, calls));

    expect(calls[0].url).toBe('https://w.example/v1/usage');
    expect(calls[0].init?.method).toBe('GET');
    expect(calls[0].init?.headers).toEqual({ authorization: 'Bearer tok_secret' });
    expect(calls[0].init?.body).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain('tok_secret');
  });

  it('reads the error code from the usage error envelope', async () => {
    const r = await hostedUsage(
      'https://w',
      't',
      fakeFetch(403, { error: { code: 'unknown_device' } })
    );

    expect(r).toMatchObject({ status: 403, ok: false, errorCode: 'unknown_device' });
  });

  it('reports unknown for a non-JSON config error body', async () => {
    const f: FetchLike = async () => ({
      status: 500,
      ok: false,
      json: async () => {
        throw new Error('html');
      },
    });

    expect(await hostedConfig('https://w', f)).toMatchObject({
      status: 500,
      errorCode: 'unknown',
    });
  });

  it('turns a thrown config fetch into status 0 and network', async () => {
    const f: FetchLike = async () => {
      throw new Error('offline');
    };

    expect(await hostedConfig('https://w', f)).toMatchObject({
      status: 0,
      ok: false,
      errorCode: 'network',
    });
  });
});
