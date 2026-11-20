import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { serverCases } from './shared-cases.mjs';
import { clientKeygen, clientSign, deriveRcId, p256, serverVerify, hexToBytes, bytesToHex, signingString } from './protocol.mjs';
import { sha256 } from '@noble/hashes/sha2.js';

const v = JSON.parse(readFileSync(new URL('./vectors.json', import.meta.url)));
serverCases(v, hexToBytes);

describe('client (noble) behaviour', () => {
  it('rc_id shape: mlg1_ + 64 hex = 69 chars', () => {
    const k = clientKeygen();
    expect(k.publicKey.length).toBe(65);
    expect(k.rcId).toMatch(/^mlg1_[0-9a-f]{64}$/);
    expect(k.rcId.length).toBe(69);
  });
  it('noble signs sha256(message) by default (prehash true) and verifies against WebCrypto', async () => {
    const k = clientKeygen(); const body = new Uint8Array([1, 2, 3]);
    const sig = clientSign(k.secretKey, 'session', k.rcId, 'n1', body);
    expect(sig.length).toBe(64);
    expect(await serverVerify({ rcId: k.rcId, publicKey: k.publicKey, purpose: 'session', expectedPurpose: 'session', nonce: 'n1', bodyBytes: body, signature: sig })).toEqual({ ok: true });
    // prehash:false over the raw message would NOT verify under WebCrypto ECDSA+SHA-256 (it hashes again)
    const msg = new TextEncoder().encode(signingString('session', k.rcId, 'n1', body));
    const bad = p256.sign(msg, k.secretKey, { prehash: false });
    expect(await serverVerify({ rcId: k.rcId, publicKey: k.publicKey, purpose: 'session', expectedPurpose: 'session', nonce: 'n1', bodyBytes: body, signature: bad })).toMatchObject({ ok: false });
    // prehash:false over sha256(msg) is equivalent to the default
    const good = p256.sign(sha256(msg), k.secretKey, { prehash: false });
    expect(await serverVerify({ rcId: k.rcId, publicKey: k.publicKey, purpose: 'session', expectedPurpose: 'session', nonce: 'n1', bodyBytes: body, signature: good })).toEqual({ ok: true });
  });
  it('noble default sign output is always low-S; lowS:false can emit high-S', () => {
    const k = clientKeygen(); const n = p256.Point.Fn.ORDER;
    let highWithDefault = 0, highWithFalse = 0;
    for (let i = 0; i < 60; i++) {
      const m = new Uint8Array([i]);
      const s1 = BigInt('0x' + bytesToHex(p256.sign(m, k.secretKey).slice(32)));
      const s2 = BigInt('0x' + bytesToHex(p256.sign(m, k.secretKey, { lowS: false, extraEntropy: true }).slice(32)));
      if (s1 > n / 2n) highWithDefault++; if (s2 > n / 2n) highWithFalse++;
    }
    console.log(`NOBLE p256 high-S counts over 60 signs: default=${highWithDefault} lowS:false=${highWithFalse}`);
    expect(highWithDefault).toBe(0);
  });
  it('noble verify rejects high-S by default; accepts with lowS:false', () => {
    const msg = new TextEncoder().encode('x'); const k = clientKeygen(); const n = p256.Point.Fn.ORDER;
    const sig = p256.sign(msg, k.secretKey);
    const s = BigInt('0x' + bytesToHex(sig.slice(32))); const hi = new Uint8Array(64); hi.set(sig.slice(0, 32));
    hi.set(hexToBytes((n - s).toString(16).padStart(64, '0')), 32);
    console.log('NOBLE verify highS default:', p256.verify(hi, msg, k.publicKey), 'lowS:false:', p256.verify(hi, msg, k.publicKey, { lowS: false }));
  });
});

describe('timing (Node, one machine)', () => {
  it('keygen / sign / verify', async () => {
    const t = (f, n) => { const a = []; for (let i = 0; i < n; i++) { const s = performance.now(); f(); a.push(performance.now() - s); } a.sort((x, y) => x - y); return { p50: a[n >> 1].toFixed(3), p99: a[Math.floor(n * .99)].toFixed(3) }; };
    const k = clientKeygen(); const msg = new TextEncoder().encode('musclog-premium-v1\nenroll\n' + k.rcId + '\nnonce\n' + 'a'.repeat(64));
    const sig = p256.sign(msg, k.secretKey);
    console.log('TIMING_NODE_ms keygen+pub+rcId', JSON.stringify(t(() => clientKeygen(), 100)));
    console.log('TIMING_NODE_ms sign', JSON.stringify(t(() => p256.sign(msg, k.secretKey), 200)));
    console.log('TIMING_NODE_ms noble verify', JSON.stringify(t(() => p256.verify(sig, msg, k.publicKey), 200)));
    const ck = await crypto.subtle.importKey('raw', k.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const a = []; for (let i = 0; i < 300; i++) { const s = performance.now(); await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, ck, sig, msg); a.push(performance.now() - s); } a.sort((x, y) => x - y);
    console.log('TIMING_NODE_ms webcrypto verify', JSON.stringify({ p50: a[150].toFixed(3), p99: a[297].toFixed(3) }));
  });
});
