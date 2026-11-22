import { describe, it, expect } from 'vitest';
import v from './vectors.json';
import { serverCases } from './shared-cases.mjs';
import { clientKeygen, clientSign, serverVerify, hexToBytes } from './protocol.mjs';

it('runs in workerd', () => {
  expect(typeof navigator !== 'undefined' && navigator.userAgent).toBe('Cloudflare-Workers');
});
serverCases(v, hexToBytes); // vectors produced by Node client, verified inside workerd with WebCrypto
it('workerd roundtrip with in-runtime noble signing', async () => {
  const k = clientKeygen(); const body = new Uint8Array([9, 9]);
  const sig = clientSign(k.secretKey, 'session', k.rcId, 'zz', body);
  expect(await serverVerify({ rcId: k.rcId, publicKey: k.publicKey, purpose: 'session', expectedPurpose: 'session', nonce: 'zz', bodyBytes: body, signature: sig })).toEqual({ ok: true });
});
