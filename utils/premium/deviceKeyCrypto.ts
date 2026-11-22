// Device key crypto for Musclog Iron (plan 6.1). Pure: no react-native or expo imports.
// The Worker (services/premium-worker/src/identity/crypto.ts) verifies exactly what this signs.
import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';

export const SIGNING_DOMAIN = 'musclog-premium-v1';
export type SignPurpose = 'enroll' | 'session';

const EMPTY = new Uint8Array(0);
const encoder = new TextEncoder();

/** The group order n; a canonical (low-S) signature has s <= (n - 1) / 2. */
const HALF_N = (p256.Point.Fn.ORDER - 1n) / 2n;

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }

  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Invalid hex string');
  }

  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return out;
}

/** P-256 key pair; the public key is the 65-byte UNCOMPRESSED point (never the compressed one). */
// noble 2.x keygen takes a 48-byte seed (32 bytes + 16 for unbiased reduction) and returns a 32-byte key.
export function generateDeviceKey(seed?: Uint8Array): {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const { secretKey } = seed ? p256.keygen(seed) : p256.keygen();

  return { secretKey, publicKey: p256.getPublicKey(secretKey, false) };
}

/** The ONE definition of the key-derived id's shape (the Worker's `identity/crypto.ts` derives the same). */
export const RC_ID_PREFIX = 'mlg1_';
export const RC_ID_PATTERN = /^mlg1_[0-9a-f]{64}$/;

export function deriveRcId(publicKey65: Uint8Array): string {
  if (publicKey65.length !== 65 || publicKey65[0] !== 4) {
    throw new Error('Expected a 65-byte uncompressed P-256 public key');
  }

  return RC_ID_PREFIX + bytesToHex(sha256(publicKey65));
}

export function buildSigningString(
  purpose: SignPurpose,
  rcId: string,
  nonce: string,
  body?: Uint8Array
): string {
  return `${SIGNING_DOMAIN}\n${purpose}\n${rcId}\n${nonce}\n${bytesToHex(sha256(body ?? EMPTY))}`;
}

export function isLowS(sig: Uint8Array): boolean {
  if (sig.length !== 64) {
    return false;
  }

  return BigInt('0x' + bytesToHex(sig.subarray(32))) <= HALF_N;
}

/** 64-byte compact r||s, low-S. The library hashes the message with SHA-256 itself. */
export function signDeviceMessage(
  secretKey: Uint8Array,
  purpose: SignPurpose,
  rcId: string,
  nonce: string,
  body?: Uint8Array
): Uint8Array {
  const message = encoder.encode(buildSigningString(purpose, rcId, nonce, body));

  return p256.sign(message, secretKey);
}

export function verifyDeviceSignature(
  publicKey: Uint8Array,
  purpose: SignPurpose,
  rcId: string,
  nonce: string,
  signature: Uint8Array,
  body?: Uint8Array
): boolean {
  if (signature.length !== 64 || !isLowS(signature)) {
    return false;
  }

  try {
    const message = encoder.encode(buildSigningString(purpose, rcId, nonce, body));

    return p256.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}
