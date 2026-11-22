import { env } from 'cloudflare:test';
import { expect, it } from 'vitest';

it('runs in workerd with the migrated D1 and the test env', async () => {
  expect(navigator.userAgent).toBe('Cloudflare-Workers');
  expect(env.WORKER_ENV).toBe('test');
  const t = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all<{ name: string }>();
  expect(t.results.map((r) => r.name)).toEqual(
    expect.arrayContaining(['devices', 'meta', 'periods', 'reservations'])
  );
});
