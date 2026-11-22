// Session token (plan 6.1): `v1.<base64url(JSON {rc, exp})>.<base64url(HMAC-SHA256)>`, 1 h.
// The MAC covers a domain-separated string, so a nonce MAC can never be presented as a token.
// Verification accepts the current key and, during rotation, SESSION_HMAC_KEY_PREVIOUS.

export const SESSION_TTL_MS = 60 * 60 * 1000;
const TOKEN_DOMAIN = 'musclog-premium-token-v1\n';

const te = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

export function hmacKey(secret: string): Promise<CryptoKey> {
  let k = keyCache.get(secret);
  if (!k) {
    k = crypto.subtle.importKey(
      'raw',
      te.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
    keyCache.set(secret, k);
  }
  return k;
}

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(
      s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
    );
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export interface SessionClaims {
  rc: string;
  exp: number;
}

export async function mintSessionToken(
  secret: string,
  rcId: string,
  now: number
): Promise<{ token: string; expiresAt: number }> {
  const exp = now + SESSION_TTL_MS;
  const payload = b64url(te.encode(JSON.stringify({ rc: rcId, exp })));
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', await hmacKey(secret), te.encode(TOKEN_DOMAIN + payload))
  );
  return { token: `v1.${payload}.${b64url(mac)}`, expiresAt: exp };
}

/** Returns the claims, or null for anything malformed, forged or expired. Never throws. */
export async function verifySessionToken(
  secrets: (string | undefined)[],
  token: string,
  now: number
): Promise<SessionClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [, payload, macText] = parts as [string, string, string];
  const mac = fromB64url(macText);
  if (!mac || mac.length !== 32) return null;
  let valid = false;
  for (const secret of secrets) {
    if (!secret) continue;
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      mac,
      te.encode(TOKEN_DOMAIN + payload)
    );
    if (ok) {
      valid = true;
      break;
    }
  }
  if (!valid) return null;
  const raw = fromB64url(payload);
  if (!raw) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(raw)) as Partial<SessionClaims>;
    if (typeof claims.rc !== 'string' || typeof claims.exp !== 'number') return null;
    if (claims.exp <= now) return null;
    return { rc: claims.rc, exp: claims.exp };
  } catch {
    return null;
  }
}

/** Reads `Authorization: Bearer <token>`. */
export function bearerToken(request: Request): string | null {
  const h = request.headers.get('authorization');
  const m = h ? /^Bearer\s+(\S+)$/i.exec(h) : null;
  return m ? m[1]! : null;
}
