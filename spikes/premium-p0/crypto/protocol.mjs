// Client half (what the app does in Hermes): @noble/curves + @noble/hashes. Server half: WebCrypto only.
import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

export const DOMAIN = 'musclog-premium-v1';

export function deriveRcId(uncompressedPub) {
  return 'mlg1_' + bytesToHex(sha256(uncompressedPub));
}

export function signingString(purpose, rcId, nonce, bodyBytes) {
  return `${DOMAIN}\n${purpose}\n${rcId}\n${nonce}\n${bytesToHex(sha256(bodyBytes))}`;
}

// ---------- client ----------
export function clientKeygen() {
  const { secretKey } = p256.keygen();
  const publicKey = p256.getPublicKey(secretKey, false); // 65-byte uncompressed
  return { secretKey, publicKey, rcId: deriveRcId(publicKey) };
}

// noble v2.4: sign(msg, sk, {prehash:true (default) => sha256(msg) is signed, lowS:true (default), format:'compact' => 64-byte r||s})
export function clientSign(secretKey, purpose, rcId, nonce, bodyBytes, opts = {}) {
  const msg = utf8ToBytes(signingString(purpose, rcId, nonce, bodyBytes));
  return p256.sign(msg, secretKey, opts);
}

// ---------- server (WebCrypto only) ----------
const te = new TextEncoder();
async function sha256Hex(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Returns {ok:true} or {ok:false, status, reason}. */
export async function serverVerify({ rcId, publicKey, purpose, nonce, bodyBytes, signature, expectedPurpose }) {
  if (purpose !== expectedPurpose) return { ok: false, status: 400, reason: 'purpose' };
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== 65 || publicKey[0] !== 4)
    return { ok: false, status: 400, reason: 'key_format' };
  if (!(signature instanceof Uint8Array) || signature.length !== 64)
    return { ok: false, status: 400, reason: 'sig_format' };
  if ('mlg1_' + (await sha256Hex(publicKey)) !== rcId) return { ok: false, status: 400, reason: 'rc_id_mismatch' };
  let key;
  try {
    key = await crypto.subtle.importKey('raw', publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  } catch {
    return { ok: false, status: 400, reason: 'key_import' }; // not on curve
  }
  const msg = te.encode(`${DOMAIN}\n${purpose}\n${rcId}\n${nonce}\n${await sha256Hex(bodyBytes)}`);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, msg);
  return ok ? { ok: true } : { ok: false, status: 401, reason: 'bad_signature' };
}

export { p256, hexToBytes, bytesToHex };
