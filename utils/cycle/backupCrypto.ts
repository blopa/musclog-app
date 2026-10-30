import 'react-native-get-random-values';

import CryptoJS from 'crypto-js';
import { z } from 'zod';

/** Password-based backups use a slow KDF and authenticated ciphertext, unlike device-key values. */
export const CYCLE_BACKUP_KDF_ITERATIONS = 210_000;
const envelopeSchema = z
  .object({
    format: z.literal('musclog-cycle-encrypted'),
    version: z.literal(1),
    algorithm: z.literal('PBKDF2-SHA256/AES-256-CBC/HMAC-SHA256'),
    iterations: z.literal(CYCLE_BACKUP_KDF_ITERATIONS),
    salt: z.string().regex(/^[a-f0-9]{32}$/),
    iv: z.string().regex(/^[a-f0-9]{32}$/),
    payload: z
      .string()
      .min(1)
      .max(7_000_000)
      .regex(/^[A-Za-z0-9+/]+=*$/),
    mac: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

function derive(password: string, salt: string) {
  const material = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(salt), {
    hasher: CryptoJS.algo.SHA256,
    keySize: 16,
    iterations: CYCLE_BACKUP_KDF_ITERATIONS,
  });
  return {
    encryption: CryptoJS.lib.WordArray.create(material.words.slice(0, 8), 32),
    authentication: CryptoJS.lib.WordArray.create(material.words.slice(8, 16), 32),
  };
}

function authenticatedText(data: Omit<z.infer<typeof envelopeSchema>, 'mac'>): string {
  return JSON.stringify([
    data.format,
    data.version,
    data.algorithm,
    data.iterations,
    data.salt,
    data.iv,
    data.payload,
  ]);
}

export function sealCycleBackup(plain: string, password: string): string {
  const salt = CryptoJS.lib.WordArray.random(16).toString();
  const iv = CryptoJS.lib.WordArray.random(16).toString();
  const keys = derive(password, salt);
  const cipher = CryptoJS.AES.encrypt(plain, keys.encryption, { iv: CryptoJS.enc.Hex.parse(iv) });
  const envelope: Omit<z.infer<typeof envelopeSchema>, 'mac'> = {
    format: 'musclog-cycle-encrypted',
    version: 1,
    algorithm: 'PBKDF2-SHA256/AES-256-CBC/HMAC-SHA256',
    iterations: CYCLE_BACKUP_KDF_ITERATIONS,
    salt,
    iv,
    payload: cipher.ciphertext.toString(CryptoJS.enc.Base64),
  };
  const mac = CryptoJS.HmacSHA256(authenticatedText(envelope), keys.authentication).toString();
  return JSON.stringify({ ...envelope, mac });
}

export function openCycleBackup(raw: unknown, password: string): string {
  const envelope = envelopeSchema.parse(raw);
  const keys = derive(password, envelope.salt);
  const expected = CryptoJS.HmacSHA256(authenticatedText(envelope), keys.authentication).toString();
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= expected.charCodeAt(i) ^ envelope.mac.charCodeAt(i);
  }

  if (difference !== 0) {
    throw new Error('invalid_cycle_backup');
  }

  const cipher = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(envelope.payload),
  });
  return CryptoJS.AES.decrypt(cipher, keys.encryption, {
    iv: CryptoJS.enc.Hex.parse(envelope.iv),
  }).toString(CryptoJS.enc.Utf8);
}
