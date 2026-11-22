import { writeFileSync } from 'node:fs';
import { clientKeygen, clientSign, p256, bytesToHex } from './protocol.mjs';
const k = clientKeygen(), o = clientKeygen();
const body = new TextEncoder().encode(JSON.stringify({ rc_id: k.rcId, hello: 'world' }));
const nonce = 'nonce-0123456789abcdef';
const sigLow = clientSign(k.secretKey, 'enroll', k.rcId, nonce, body);
// high-S variant: s' = n - s
const n = p256.Point.Fn.ORDER;
const r = sigLow.slice(0, 32), s = BigInt('0x' + bytesToHex(sigLow.slice(32)));
const s2 = n - s;
const sigHigh = new Uint8Array(64); sigHigh.set(r);
sigHigh.set(Uint8Array.from(s2.toString(16).padStart(64, '0').match(/../g).map((h) => parseInt(h, 16))), 32);
writeFileSync('vectors.json', JSON.stringify({
  rcId: k.rcId, pub: bytesToHex(k.publicKey), purpose: 'enroll', nonce, body: bytesToHex(body),
  sigLow: bytesToHex(sigLow), sigHigh: bytesToHex(sigHigh), other: { rcId: o.rcId, pub: bytesToHex(o.publicKey) },
}, null, 1));
console.log('vectors written; sLow<=n/2:', s <= n / 2n, 'sHigh>n/2:', s2 > n / 2n);
