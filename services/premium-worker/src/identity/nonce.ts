// Server-issued nonce (plan 6.1): n1.<ts ms>.<32 hex random>.<b64url HMAC>. Stateless; single
// use comes from `nonce_ts > devices.last_nonce_ts`. The MAC covers a domain-separated string
// so it can never be presented as a session token (and the reverse).
import type { Ctx } from '../context';
import { b64url, fromB64url, hmacKey } from './token';

export const NONCE_TTL_MS = 120_000;
export const NONCE_FUTURE_SKEW_MS = 5_000;
const NONCE_DOMAIN = 'musclog-premium-nonce-v1\n';
const te = new TextEncoder();

const macInput = (ts: number, rand: string) => te.encode(`${NONCE_DOMAIN}${ts}\n${rand}`);

export async function mintNonce(ctx: Ctx): Promise<string> {
  const ts = ctx.deps.now();
  const rand = ctx.deps.randomHex();
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', await hmacKey(ctx.env.SESSION_HMAC_KEY), macInput(ts, rand))
  );
  return `n1.${ts}.${rand}.${b64url(mac)}`;
}

/** The nonce's timestamp when the MAC is valid and the age is in range; null otherwise. */
export async function verifyNonce(ctx: Ctx, nonce: string): Promise<number | null> {
  const parts = nonce.split('.');
  if (parts.length !== 4 || parts[0] !== 'n1') return null;
  const [, tsText, rand, macText] = parts as [string, string, string, string];
  if (!/^\d{1,15}$/.test(tsText) || !/^[0-9a-f]{32}$/.test(rand)) return null;
  const mac = fromB64url(macText);
  if (!mac || mac.length !== 32) return null;
  const ts = Number(tsText);
  let valid = false;
  for (const secret of [ctx.env.SESSION_HMAC_KEY, ctx.env.SESSION_HMAC_KEY_PREVIOUS]) {
    if (!secret) continue;
    if (await crypto.subtle.verify('HMAC', await hmacKey(secret), mac, macInput(ts, rand))) {
      valid = true;
      break;
    }
  }
  if (!valid) return null;
  const now = ctx.deps.now();
  if (now - ts > NONCE_TTL_MS || ts > now + NONCE_FUTURE_SKEW_MS) return null;
  return ts;
}
