import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { p256 } from '@noble/curves/nist.js';

import {
  buildSigningString,
  bytesToHex,
  deriveRcId,
  generateDeviceKey,
  hexToBytes,
  isLowS,
  signDeviceMessage,
  verifyDeviceSignature,
} from '../deviceKeyCrypto';

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../services/premium-worker/test/fixtures/crypto-vectors.json'),
    'utf8'
  )
);
const utf8 = (s: string) => new TextEncoder().encode(s);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

async function webVerify(pub: Uint8Array, sig: Uint8Array, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    pub as Uint8Array<ArrayBuffer>,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    sig as Uint8Array<ArrayBuffer>,
    utf8(message) as Uint8Array<ArrayBuffer>
  );
}

describe('hex helpers', () => {
  it('round-trips and validates', () => {
    expect(bytesToHex(hexToBytes('00ff10'))).toBe('00ff10');
    expect(() => hexToBytes('abc')).toThrow();
    expect(() => hexToBytes('zz')).toThrow();
  });
});

describe('worker vectors', () => {
  const pub = hexToBytes(vectors.pub);
  const body = hexToBytes(vectors.body);

  it('derives the rc_id from the 65-byte key', () => {
    expect(deriveRcId(pub)).toBe(vectors.rcId);
    expect(vectors.rcId).toHaveLength(69);
  });

  it('builds the exact signing string', () => {
    const expected = `musclog-premium-v1\n${vectors.purpose}\n${vectors.rcId}\n${vectors.nonce}\n${sha(body)}`;
    expect(buildSigningString(vectors.purpose, vectors.rcId, vectors.nonce, body)).toBe(expected);
    expect(buildSigningString('session', 'r', 'n')).toBe(
      `musclog-premium-v1\nsession\nr\nn\n${sha(new Uint8Array(0))}`
    );
  });

  it('accepts the low-S signature and rejects the high-S one', () => {
    const args = [vectors.purpose, vectors.rcId, vectors.nonce] as const;
    expect(verifyDeviceSignature(pub, ...args, hexToBytes(vectors.sigLow), body)).toBe(true);
    expect(isLowS(hexToBytes(vectors.sigLow))).toBe(true);
    expect(isLowS(hexToBytes(vectors.sigHigh))).toBe(false);
    expect(verifyDeviceSignature(pub, ...args, hexToBytes(vectors.sigHigh), body)).toBe(false);
  });

  it('rejects a signature for another purpose, nonce, body, rc_id or key', () => {
    const sig = hexToBytes(vectors.sigLow);
    const { purpose, rcId, nonce } = vectors;
    expect(verifyDeviceSignature(pub, 'session', rcId, nonce, sig, body)).toBe(false);
    expect(verifyDeviceSignature(pub, purpose, rcId, 'other', sig, body)).toBe(false);
    expect(verifyDeviceSignature(pub, purpose, rcId, nonce, sig, utf8('x'))).toBe(false);
    expect(verifyDeviceSignature(pub, purpose, vectors.other.rcId, nonce, sig, body)).toBe(false);
    expect(
      verifyDeviceSignature(hexToBytes(vectors.other.pub), purpose, rcId, nonce, sig, body)
    ).toBe(false);
    expect(verifyDeviceSignature(pub, purpose, rcId, nonce, sig.subarray(0, 63), body)).toBe(false);
  });
});

describe('known answer', () => {
  const secretKey = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
  const pub = p256.getPublicKey(secretKey, false);
  const rcId = deriveRcId(pub);
  const body = utf8('hello');

  it('signs deterministically and WebCrypto verifies it', async () => {
    const sig = signDeviceMessage(secretKey, 'enroll', rcId, 'nonce-1', body);
    expect(bytesToHex(sig)).toBe(
      '9f88b75ee23c436bce156681946b5bc39488f8a113317066ac9efe41137d81de5201788f48e6ead41bb9533373aa77cbf4f528fac67ab399f64d933ef5dd6e59'
    );
    expect(sig).toHaveLength(64);
    expect(await webVerify(pub, sig, buildSigningString('enroll', rcId, 'nonce-1', body))).toBe(
      true
    );
  });
});

describe('random keys', () => {
  it('produces low-S signatures that WebCrypto verifies', async () => {
    for (let i = 0; i < 200; i += 1) {
      const { secretKey, publicKey } = generateDeviceKey();
      const rcId = deriveRcId(publicKey);
      const nonce = `n${i}`;
      const sig = signDeviceMessage(secretKey, 'session', rcId, nonce);
      expect(isLowS(sig)).toBe(true);
      expect(verifyDeviceSignature(publicKey, 'session', rcId, nonce, sig)).toBe(true);
      // eslint-disable-next-line no-await-in-loop
      expect(await webVerify(publicKey, sig, buildSigningString('session', rcId, nonce))).toBe(
        true
      );
    }
  });

  it('derives the rc_id from the uncompressed key only', () => {
    const { publicKey } = generateDeviceKey();
    const rcId = deriveRcId(publicKey);
    expect(publicKey).toHaveLength(65);
    expect(rcId).toHaveLength(69);

    const compressed = p256.getPublicKey(generateDeviceKey().secretKey, true);
    expect(compressed).toHaveLength(33);
    expect(() => deriveRcId(compressed)).toThrow();
    expect('mlg1_' + sha(p256.getPublicKey(p256.keygen().secretKey, true))).not.toBe(rcId);
  });

  it('is deterministic for a fixed seed', () => {
    const seed = Uint8Array.from({ length: 48 }, (_, i) => 255 - i);
    const a = generateDeviceKey(seed);
    const b = generateDeviceKey(seed);
    expect(bytesToHex(a.secretKey)).toBe(bytesToHex(b.secretKey));
    expect(bytesToHex(a.publicKey)).toBe(bytesToHex(b.publicKey));
    expect(a.publicKey[0]).toBe(4);
  });
});
