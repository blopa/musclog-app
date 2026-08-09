/**
 * Optical transfer — optional passphrase encryption.
 *
 * WHY NOT `utils/encryption.ts`: that module's `encrypt()` is built for storing short strings in
 * the database. It returns crypto-js's OpenSSL-style **base64 string**, which would inflate the
 * ciphertext by 33% on a channel where every byte costs real seconds, and it derives its key with
 * `EvpKDF` — MD5, one iteration — which is not something to hand a user-chosen passphrase.
 *
 * So this stays binary end to end and uses PBKDF2-HMAC-SHA256 with the iteration count written
 * into the container header, so it can be raised later without breaking old backups.
 *
 * THE THREAT MODEL IS NARROW. A QR stream is readable by any camera pointed at the sending screen
 * for the duration of the transfer. Encryption is what makes a bystander's recording useless; it
 * is not protection against someone who controls either phone.
 */

import 'react-native-get-random-values';

import CryptoJS from 'crypto-js';

export const OPTICAL_KDF_NONE = 0;
export const OPTICAL_KDF_PBKDF2_SHA256 = 1;
export const OPTICAL_CIPHER_NONE = 0;
export const OPTICAL_CIPHER_AES256_CBC = 1;

export const OPTICAL_KDF_SALT_BYTES = 16;
export const OPTICAL_CIPHER_IV_BYTES = 16;

/**
 * Deliberately modest. crypto-js runs PBKDF2 in interpreted JavaScript under Hermes, so a high
 * count is paid twice — once per phone — on the critical path of a transfer the user is standing
 * there waiting for. The count travels in the container header, so raising it later is a
 * one-constant change that old containers still decrypt.
 */
export const DEFAULT_OPTICAL_KDF_ITERATIONS = 10_000;

type WordArray = CryptoJS.lib.WordArray;

export function randomBytes(length: number): Uint8Array {
  return bytesFromWordArray(CryptoJS.lib.WordArray.random(length));
}

export function wordArrayFromBytes(bytes: Uint8Array): WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

export function bytesFromWordArray(wordArray: WordArray): Uint8Array {
  const { words, sigBytes } = wordArray;
  const out = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    out[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return out;
}

export function sha256(bytes: Uint8Array): Uint8Array {
  return bytesFromWordArray(CryptoJS.SHA256(wordArrayFromBytes(bytes)));
}

export function deriveOpticalKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): WordArray {
  return CryptoJS.PBKDF2(passphrase, wordArrayFromBytes(salt), {
    hasher: CryptoJS.algo.SHA256,
    iterations,
    keySize: 256 / 32,
  });
}

export function encryptOpticalBody(body: Uint8Array, key: WordArray, iv: Uint8Array): Uint8Array {
  const encrypted = CryptoJS.AES.encrypt(wordArrayFromBytes(body), key, {
    iv: wordArrayFromBytes(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return bytesFromWordArray(encrypted.ciphertext);
}

/**
 * Throws on a wrong passphrase — but only *usually*. PKCS#7 unpadding fails for the overwhelming
 * majority of wrong keys, yet roughly 1 in 256 wrong keys happens to leave a byte-sequence that
 * unpads cleanly and yields garbage. The container's SHA-256 over the decrypted plaintext is what
 * actually decides, so callers must treat a successful return here as "probably" and let the hash
 * be the authority.
 */
export function decryptOpticalBody(body: Uint8Array, key: WordArray, iv: Uint8Array): Uint8Array {
  const decrypted = CryptoJS.AES.decrypt(
    // `create` takes the raw ciphertext; crypto-js otherwise expects its own OpenSSL envelope.
    CryptoJS.lib.CipherParams.create({ ciphertext: wordArrayFromBytes(body) }),
    key,
    {
      iv: wordArrayFromBytes(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  );

  if (decrypted.sigBytes <= 0) {
    throw new Error('Decryption produced no output');
  }
  return bytesFromWordArray(decrypted);
}
