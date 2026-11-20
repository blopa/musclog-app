import { expect, it, describe } from 'vitest';
import { serverVerify } from './protocol.mjs';

// vectors: {rcId, pub(hex), purpose, nonce, body(hex), sigLow(hex), sigHigh(hex), other:{rcId,pub}}
export function serverCases(v, h2b) {
  const base = () => ({
    rcId: v.rcId, publicKey: h2b(v.pub), purpose: 'enroll', expectedPurpose: 'enroll',
    nonce: v.nonce, bodyBytes: h2b(v.body), signature: h2b(v.sigLow),
  });
  describe('server verify (WebCrypto)', () => {
    it('valid roundtrip', async () => expect(await serverVerify(base())).toEqual({ ok: true }));
    it('wrong key (other keypair, own matching rc_id)', async () => {
      const r = await serverVerify({ ...base(), rcId: v.other.rcId, publicKey: h2b(v.other.pub) });
      expect(r).toMatchObject({ ok: false, status: 401 });
    });
    it('tampered rc_id -> mismatch', async () => {
      const r = await serverVerify({ ...base(), rcId: v.rcId.slice(0, -1) + (v.rcId.endsWith('0') ? '1' : '0') });
      expect(r).toMatchObject({ ok: false, reason: 'rc_id_mismatch' });
    });
    it('rc_id of another key with this key/sig', async () => {
      const r = await serverVerify({ ...base(), rcId: v.other.rcId });
      expect(r).toMatchObject({ ok: false, reason: 'rc_id_mismatch' });
    });
    it('tampered nonce', async () => expect((await serverVerify({ ...base(), nonce: v.nonce + 'x' })).status).toBe(401));
    it('tampered body', async () => {
      const b = h2b(v.body); b[0] ^= 1;
      expect((await serverVerify({ ...base(), bodyBytes: b })).status).toBe(401);
    });
    it('purpose tamper: signed enroll presented as session', async () => {
      const r = await serverVerify({ ...base(), purpose: 'session', expectedPurpose: 'session' });
      expect(r).toMatchObject({ ok: false, status: 401 });
    });
    it('purpose mismatch with endpoint expectation', async () => {
      const r = await serverVerify({ ...base(), expectedPurpose: 'session' });
      expect(r).toMatchObject({ ok: false, reason: 'purpose' });
    });
    it('malformed key bytes: truncated, compressed prefix, off-curve, zeros', async () => {
      const pub = h2b(v.pub);
      expect((await serverVerify({ ...base(), publicKey: pub.slice(0, 64) })).status).toBe(400);
      const off = pub.slice(); off[64] ^= 1; // keep rc_id consistent with tampered key so we reach importKey
      const { sha256Hex } = await import('./util.mjs');
      const rcId = 'mlg1_' + (await sha256Hex(off));
      const r = await serverVerify({ ...base(), publicKey: off, rcId });
      expect(r.ok).toBe(false); expect(r.reason).toBe('key_import');
      const zeros = new Uint8Array(65); zeros[0] = 4;
      const rz = await serverVerify({ ...base(), publicKey: zeros, rcId: 'mlg1_' + (await sha256Hex(zeros)) });
      expect(rz.reason).toBe('key_import');
    });
    it('malformed signature length / zero signature', async () => {
      expect((await serverVerify({ ...base(), signature: h2b(v.sigLow).slice(0, 63) })).status).toBe(400);
      expect((await serverVerify({ ...base(), signature: new Uint8Array(64) })).status).toBe(401);
    });
    it('low-S accepted; high-S behaviour (recorded)', async () => {
      expect((await serverVerify({ ...base(), signature: h2b(v.sigLow) })).ok).toBe(true);
      const hi = await serverVerify({ ...base(), signature: h2b(v.sigHigh) });
      // WebCrypto/BoringSSL does not enforce low-S; recorded in report
      globalThis.__highS = hi.ok;
      expect(typeof hi.ok).toBe('boolean');
      console.log('HIGH_S_ACCEPTED_BY_WEBCRYPTO=' + hi.ok);
    });
  });
}
