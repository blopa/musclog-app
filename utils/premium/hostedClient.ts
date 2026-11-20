// Thin client for the Premium Worker identity routes (services/premium-worker/src/routes).
// Pure: fetch is injected. The harness log only ever sees `redacted`, never a usable token.

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown> }>;

export type HostedResult = {
  status: number;
  ok: boolean;
  errorCode: string | null;
  body: unknown;
  redacted: unknown;
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Unpadded base64url. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0;

    out += B64.charAt(b0 >> 2) + B64.charAt(((b0 & 3) << 4) | (b1 >> 4));

    if (i + 1 < bytes.length) {
      out += B64.charAt(((b1 & 15) << 2) | (b2 >> 6));
    }

    if (i + 2 < bytes.length) {
      out += B64.charAt(b2 & 63);
    }
  }

  return out;
}

function isTokenKey(key: string): boolean {
  return key === 'token' || key.endsWith('_token');
}

/** Copy of `value` with every token string replaced by its length and 8-char prefix. */
export function redactTokens(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactTokens);
  }

  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};

    for (const [key, v] of Object.entries(value)) {
      out[key] =
        isTokenKey(key) && typeof v === 'string'
          ? `<token len=${v.length} prefix=${v.slice(0, 8)}>`
          : redactTokens(v);
    }

    return out;
  }

  return value;
}

function errorCodeOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const error = (body as { error?: unknown }).error;

  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === 'string' ? code : null;
}

async function call(
  baseUrl: string,
  path: string,
  fetchImpl: FetchLike,
  payload?: Record<string, string>,
  bearer?: string
): Promise<HostedResult> {
  const url = baseUrl.replace(/\/+$/, '') + path;
  const headers: Record<string, string> = {};

  if (payload) {
    headers['content-type'] = 'application/json';
  }

  if (bearer !== undefined) {
    headers.authorization = `Bearer ${bearer}`;
  }

  const init: { method: string; headers?: Record<string, string>; body?: string } = {
    method: payload ? 'POST' : 'GET',
  };

  if (Object.keys(headers).length > 0) {
    init.headers = headers;
  }

  if (payload) {
    init.body = JSON.stringify(payload);
  }

  try {
    const response = await fetchImpl(url, init);
    let body: unknown = null;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    return {
      status: response.status,
      ok: response.ok,
      errorCode: response.ok ? null : (errorCodeOf(body) ?? 'unknown'),
      body,
      redacted: redactTokens(body),
    };
  } catch (e) {
    const message = { message: e instanceof Error ? e.message : String(e) };

    return { status: 0, ok: false, errorCode: 'network', body: message, redacted: message };
  }
}

export function hostedChallenge(baseUrl: string, fetchImpl: FetchLike): Promise<HostedResult> {
  return call(baseUrl, '/v1/challenge', fetchImpl);
}

export function hostedConfig(baseUrl: string, fetchImpl: FetchLike): Promise<HostedResult> {
  return call(baseUrl, '/v1/config', fetchImpl);
}

export function hostedUsage(
  baseUrl: string,
  sessionToken: string,
  fetchImpl: FetchLike
): Promise<HostedResult> {
  return call(baseUrl, '/v1/usage', fetchImpl, undefined, sessionToken);
}

export function hostedEnroll(
  baseUrl: string,
  input: { rcId: string; publicKey: Uint8Array; nonce: string; signature: Uint8Array },
  fetchImpl: FetchLike
): Promise<HostedResult> {
  return call(baseUrl, '/v1/enroll', fetchImpl, {
    rc_id: input.rcId,
    public_key: toBase64Url(input.publicKey),
    nonce: input.nonce,
    signature: toBase64Url(input.signature),
  });
}

export function hostedSession(
  baseUrl: string,
  input: { rcId: string; nonce: string; signature: Uint8Array },
  fetchImpl: FetchLike
): Promise<HostedResult> {
  return call(baseUrl, '/v1/session', fetchImpl, {
    rc_id: input.rcId,
    nonce: input.nonce,
    signature: toBase64Url(input.signature),
  });
}
