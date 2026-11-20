// Client-side helpers (what the app does in Hermes): @noble/curves + @noble/hashes, exactly as
// spikes/premium-p0/crypto/protocol.mjs. Plus a harness that drives the worker through createApp.
import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { createExecutionContext, env } from 'cloudflare:test';

import { createApp } from '../../src/app';
import { b64url } from '../../src/identity/token';
import { testDeps, type TestDeps } from './ctx';
import { fakeRevenueCat, type FakeRevenueCat } from './revenuecat';

export const SIGNING_DOMAIN = 'musclog-premium-v1';
const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;

export interface TestDevice {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
  rcId: string;
}

export function newDevice(): TestDevice {
  const { secretKey } = p256.keygen();
  const publicKey = p256.getPublicKey(secretKey, false); // 65-byte uncompressed
  return { secretKey, publicKey, rcId: 'mlg1_' + bytesToHex(sha256(publicKey)) };
}

export function signingString(purpose: string, rcId: string, nonce: string): string {
  return `${SIGNING_DOMAIN}\n${purpose}\n${rcId}\n${nonce}\n${bytesToHex(sha256(new Uint8Array()))}`;
}

export function sign(device: TestDevice, purpose: string, nonce: string, rcId = device.rcId) {
  return p256.sign(utf8ToBytes(signingString(purpose, rcId, nonce)), device.secretKey);
}

/** The other valid encoding (r, n - s) of a signature: high-S. */
export function highS(sig: Uint8Array): Uint8Array {
  const s = BigInt('0x' + bytesToHex(sig.subarray(32)));
  const out = sig.slice();
  out.set(hexBytes((P256_N - s).toString(16).padStart(64, '0')), 32);
  return out;
}

function hexBytes(h: string): Uint8Array {
  return Uint8Array.from(h.match(/../g)!, (x) => parseInt(x, 16));
}

export function enrollBody(device: TestDevice, nonce: string) {
  return {
    rc_id: device.rcId,
    public_key: b64url(device.publicKey),
    nonce,
    signature: b64url(sign(device, 'enroll', nonce)),
  };
}

export function sessionBody(device: TestDevice, nonce: string) {
  return { rc_id: device.rcId, nonce, signature: b64url(sign(device, 'session', nonce)) };
}

export { b64url };

export interface Harness {
  rc: FakeRevenueCat;
  deps: TestDeps;
  /** Drives the worker; `over` replaces env bindings for this call. */
  call(path: string, init?: RequestInit, over?: Record<string, unknown>): Promise<Response>;
  /** Advances the clock 1 ms (so nonces are strictly increasing), then GET /v1/challenge. */
  nonce(over?: Record<string, unknown>): Promise<string>;
  post(path: string, body: unknown, over?: Record<string, unknown>): Promise<Response>;
  enroll(d: TestDevice, over?: Record<string, unknown>): Promise<Response>;
  session(d: TestDevice, over?: Record<string, unknown>): Promise<Response>;
  usage(token: string, over?: Record<string, unknown>): Promise<Response>;
}

export function harness(): Harness {
  const rc = fakeRevenueCat();
  const deps = testDeps({ revenuecat: rc });
  const app = createApp(() => deps);
  const h: Harness = {
    rc,
    deps,
    call: (path, init, over) =>
      app.fetch!(
        new Request('https://worker.test' + path, init) as never,
        { ...env, ...over } as never,
        createExecutionContext()
      ) as Promise<Response>,
    async nonce(over) {
      deps.advance(1);
      const r = await h.call('/v1/challenge', undefined, over);
      return ((await r.json()) as { nonce: string }).nonce;
    },
    post: (path, body, over) => h.call(path, { method: 'POST', body: JSON.stringify(body) }, over),
    async enroll(d, over) {
      return h.post('/v1/enroll', enrollBody(d, await h.nonce(over)), over);
    },
    async session(d, over) {
      return h.post('/v1/session', sessionBody(d, await h.nonce(over)), over);
    },
    usage: (token, over) =>
      h.call('/v1/usage', { headers: { authorization: `Bearer ${token}` } }, over),
  };
  return h;
}
