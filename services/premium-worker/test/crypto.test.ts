// Ported from spikes/premium-p0/crypto/shared-cases.mjs, adjusted: high-S is now rejected.
import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';

import {
  deriveRcId,
  importBoundKey,
  isLowS,
  verifyDeviceSignature,
  type Purpose,
} from '../src/identity/crypto';
import vectors from './fixtures/crypto-vectors.json';
import { highS, newDevice, sign } from './fakes/device';

const v = vectors;
const h2b = (h: string) => hexToBytes(h) as Uint8Array<ArrayBuffer>;

async function verify(
  o: {
    rcId?: string;
    pub?: Uint8Array<ArrayBuffer>;
    purpose?: Purpose;
    nonce?: string;
    body?: Uint8Array<ArrayBuffer>;
    sig?: Uint8Array<ArrayBuffer>;
  } = {}
): Promise<'key' | 'sig_bad' | 'ok'> {
  const rcId = o.rcId ?? v.rcId;
  const key = await importBoundKey(rcId, o.pub ?? h2b(v.pub));
  if (!key) return 'key';
  const ok = await verifyDeviceSignature({
    key,
    purpose: o.purpose ?? 'enroll',
    rcId,
    nonce: o.nonce ?? v.nonce,
    body: o.body ?? h2b(v.body),
    signature: o.sig ?? h2b(v.sigLow),
  });
  return ok ? 'ok' : 'sig_bad';
}

describe('device signature verification (WebCrypto)', () => {
  it('valid roundtrip', async () => expect(await verify()).toBe('ok'));

  it('wrong key (other keypair with its own matching rc_id)', async () =>
    expect(await verify({ rcId: v.other.rcId, pub: h2b(v.other.pub) })).toBe('sig_bad'));

  it('tampered rc_id and the rc_id of another key are an id/key mismatch', async () => {
    const flipped = v.rcId.slice(0, -1) + (v.rcId.endsWith('0') ? '1' : '0');
    expect(await verify({ rcId: flipped })).toBe('key');
    expect(await verify({ rcId: v.other.rcId })).toBe('key');
  });

  it('tampered nonce / body, and enroll presented as session', async () => {
    expect(await verify({ nonce: v.nonce + 'x' })).toBe('sig_bad');
    const body = h2b(v.body);
    body[0]! ^= 1;
    expect(await verify({ body })).toBe('sig_bad');
    expect(await verify({ purpose: 'session' })).toBe('sig_bad');
  });

  it('malformed keys: truncated, compressed prefix, off-curve, all zeros', async () => {
    const pub = h2b(v.pub);
    expect(await importBoundKey(v.rcId, pub.slice(0, 64))).toBeNull();
    expect(await importBoundKey(v.rcId, null)).toBeNull();
    const compressedPrefix = pub.slice();
    compressedPrefix[0] = 2;
    expect(await importBoundKey(await deriveRcId(compressedPrefix), compressedPrefix)).toBeNull();
    const off = pub.slice();
    off[64]! ^= 1; // an rc_id consistent with the tampered key, so only the curve check can fail
    expect(await importBoundKey(await deriveRcId(off), off)).toBeNull();
    const zeros = new Uint8Array(65);
    zeros[0] = 4;
    expect(await importBoundKey(await deriveRcId(zeros), zeros)).toBeNull();
  });

  it('malformed signatures: wrong length, all zero', async () => {
    expect(await verify({ sig: h2b(v.sigLow).slice(0, 63) })).toBe('sig_bad');
    expect(await verify({ sig: new Uint8Array(65) })).toBe('sig_bad');
    expect(await verify({ sig: new Uint8Array(64) })).toBe('sig_bad');
  });

  it('low-S accepted, high-S rejected (WebCrypto would accept both)', async () => {
    expect(isLowS(h2b(v.sigLow))).toBe(true);
    expect(isLowS(h2b(v.sigHigh))).toBe(false);
    expect(await verify({ sig: h2b(v.sigLow) })).toBe('ok');
    expect(await verify({ sig: h2b(v.sigHigh) })).toBe('sig_bad');
  });

  it('a noble signature made in workerd verifies, its high-S twin does not', async () => {
    const d = newDevice();
    const key = (await importBoundKey(d.rcId, d.publicKey as Uint8Array<ArrayBuffer>))!;
    const sig = sign(d, 'session', 'n') as Uint8Array<ArrayBuffer>;
    const base = { key, purpose: 'session' as const, rcId: d.rcId, nonce: 'n' };
    expect(await verifyDeviceSignature({ ...base, signature: sig })).toBe(true);
    expect(
      await verifyDeviceSignature({ ...base, signature: highS(sig) as Uint8Array<ArrayBuffer> })
    ).toBe(false);
  });
});
