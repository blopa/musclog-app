// Device-key verification (plan 6.1), WebCrypto only. Ported from spikes/premium-p0/crypto
// (serverVerify). Differences from the spike: the signed body is the empty byte string by
// default, and high-S signatures are rejected before verify (WebCrypto accepts both encodings).

export const SIGNING_DOMAIN = 'musclog-premium-v1';
export type Purpose = 'enroll' | 'session';

const te = new TextEncoder();
const EMPTY = new Uint8Array(0);

/** The P-256 group order n and (n - 1) / 2: a canonical (low-S) signature has s <= HALF_N. */
const HALF_N = 0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8n;

export function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

export async function deriveRcId(publicKey: Uint8Array<ArrayBuffer>): Promise<string> {
  return 'mlg1_' + (await sha256Hex(publicKey));
}

/**
 * Checks the 65-byte uncompressed key, that rc_id is its hash and that the point is on the
 * curve (importKey throws otherwise). Returns the imported key, or null for any failure.
 */
export async function importBoundKey(
  rcId: string,
  publicKey: Uint8Array<ArrayBuffer> | null
): Promise<CryptoKey | null> {
  if (!publicKey || publicKey.length !== 65 || publicKey[0] !== 4) return null;
  if ((await deriveRcId(publicKey)) !== rcId) return null;
  return importPublicKey(publicKey);
}

export async function importPublicKey(
  publicKey: Uint8Array<ArrayBuffer>
): Promise<CryptoKey | null> {
  try {
    return await crypto.subtle.importKey(
      'raw',
      publicKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
  } catch {
    return null;
  }
}

/** True for a 64-byte r||s whose s is in the lower half of the group order. */
export function isLowS(signature: Uint8Array): boolean {
  if (signature.length !== 64) return false;
  return BigInt('0x' + hex(signature.subarray(32))) <= HALF_N;
}

export async function signingString(
  purpose: Purpose,
  rcId: string,
  nonce: string,
  body: Uint8Array<ArrayBuffer> = EMPTY
): Promise<string> {
  return `${SIGNING_DOMAIN}\n${purpose}\n${rcId}\n${nonce}\n${await sha256Hex(body)}`;
}

/** Low-S check first, then the ECDSA verify of the domain-separated string. Never throws. */
export async function verifyDeviceSignature(o: {
  key: CryptoKey;
  purpose: Purpose;
  rcId: string;
  nonce: string;
  signature: Uint8Array<ArrayBuffer> | null;
  body?: Uint8Array<ArrayBuffer>;
}): Promise<boolean> {
  if (!o.signature || o.signature.length !== 64 || !isLowS(o.signature)) return false;
  try {
    const msg = te.encode(await signingString(o.purpose, o.rcId, o.nonce, o.body));
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, o.key, o.signature, msg);
  } catch {
    return false;
  }
}
