// Shared driver for the chat endpoint tests: builds requests, runs them through createApp with
// injected fakes, and tracks every secret that must never reach a log line.
import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';

import { createApp } from '../src/app';
import type { LogEvent } from '../src/log';
import { mintSessionToken } from '../src/identity/token';
import { NOW, testConfig, testDeps, throwingOpenRouter, type TestDeps } from './fakes/ctx';
import type { FakeOpenRouter } from './fakes/openrouter';
import { OTARI_CONFIG, type FakeOtari } from './fakes/otari';
import { resetUpstreamCache } from '../src/upstream/select';
import type { AiConfig } from '../src/config';

export { NOW };
export const IDEM = 'idem-key-0001';
export const PROMPT = 'SECRET_PROMPT_TEXT_42';

/** Everything a log line must not contain, accumulated over the whole file. */
export const watch = { secrets: new Set<string>([PROMPT, 'rc1']), logs: [] as LogEvent[] };

export const chatBody = (over: Record<string, unknown> = {}) => ({
  model: 'whatever-the-sdk-sends',
  messages: [
    { role: 'system', content: 'You are a coach.' },
    { role: 'user', content: PROMPT },
  ],
  ...over,
});

export async function tokenFor(rc = 'rc1', at = NOW): Promise<string> {
  const { token } = await mintSessionToken(env.SESSION_HMAC_KEY, rc, at);
  watch.secrets.add(token);
  return token;
}

export const OTARI_KEY = 'test-otari-key';

/** Flips the D1 toggle to Otari (the 30 s cache is cleared so the next request reads it). */
export async function useOtari(value = 'otari'): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO meta (key, value) VALUES ('upstream', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(value)
    .run();
  resetUpstreamCache();
}

export interface CallOptions {
  or?: FakeOpenRouter;
  /** An Otari fake: gives the Worker an Otari key, the `otari` config block and the client. */
  otari?: FakeOtari;
  body?: unknown;
  /** Raw body, used instead of JSON.stringify(body) (oversize and stream bodies). */
  rawBody?: BodyInit;
  key?: string | null;
  token?: string | null;
  headers?: Record<string, string>;
  env?: Record<string, unknown>;
  config?: AiConfig;
  deps?: TestDeps;
}

export interface CallResult {
  res: Response;
  exec: ExecutionContext;
  deps: TestDeps;
  /** Waits for every waitUntil (settlement), then returns. */
  done(): Promise<void>;
}

// testDeps' own randomHex restarts at 1 per instance; hold tokens must differ between requests.
let holdSeq = 0;
const uniqueHold = () => (++holdSeq).toString(16).padStart(32, '0');

export async function call(o: CallOptions): Promise<CallResult> {
  const deps =
    o.deps ??
    testDeps({
      openrouter: o.or ?? throwingOpenRouter,
      otari: o.otari ?? null,
      randomHex: uniqueHold,
    });
  const config = o.config ?? (o.otari ? testConfig({ otari: OTARI_CONFIG }) : undefined);
  const headers: Record<string, string> = { 'content-type': 'application/json', ...o.headers };
  const key = o.key === undefined ? IDEM : o.key;
  if (key !== null) {
    headers['idempotency-key'] = key;
    watch.secrets.add(key);
  }
  const token = o.token === undefined ? await tokenFor() : o.token;
  if (token !== null) headers.authorization = `Bearer ${token}`;
  const request = new Request('https://worker.test/v1/chat/completions', {
    method: 'POST',
    headers,
    body: o.rawBody ?? JSON.stringify(o.body ?? chatBody()),
  });
  const exec = createExecutionContext();
  const e = {
    ...env,
    ...(config ? { AI_CONFIG_JSON: JSON.stringify(config) } : {}),
    ...(o.otari ? { OTARI_API_KEY: OTARI_KEY } : {}),
    ...o.env,
  };
  const res = await createApp(() => deps).fetch!(request as never, e as never, exec);
  watch.logs.push(...deps.logs);
  return { res, exec, deps, done: () => waitOnExecutionContext(exec) };
}

export const config = () => testConfig();

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function until(cond: () => boolean, ms = 2000): Promise<void> {
  const t = Date.now();
  while (!cond()) {
    if (Date.now() - t > ms) throw new Error('until: timed out');
    await sleep(5);
  }
}

export interface Row {
  state: string;
  reserved_u: number;
  settled_u: number | null;
  req_id: string;
}
export async function reservations(): Promise<Row[]> {
  return (await env.DB.prepare('SELECT * FROM reservations').all<Row>()).results;
}
export async function onlyReservation(): Promise<Row> {
  const rows = await reservations();
  if (rows.length !== 1) throw new Error(`expected 1 reservation, got ${rows.length}`);
  return rows[0]!;
}
export async function meta(key: string): Promise<string | null> {
  const r = await env.DB.prepare('SELECT value FROM meta WHERE key = ?1')
    .bind(key)
    .first<{ value: string }>();
  return r?.value ?? null;
}
