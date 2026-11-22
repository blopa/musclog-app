import { describe, expect, it } from 'vitest';
import { scrubEvent, sentryOptions, tracesSampleRateFor } from '../src/sentry';
import type { Env } from '../src/env';

describe('sentry scrubbing', () => {
  it('keeps the exception type and stack but drops message, request, user and breadcrumbs', () => {
    const event = scrubEvent({
      request: { url: 'https://x/v1/chat/completions', headers: { authorization: 'Bearer t' } },
      user: { ip_address: '1.2.3.4' },
      breadcrumbs: [{ message: 'prompt text' }],
      extra: { body: 'secret' },
      message: 'prompt text',
      exception: { values: [{ type: 'TypeError', value: 'user prompt echoed here' }] },
      contexts: { trace: { trace_id: 'a' }, device: { model: 'x' } },
      tags: { route: '/v1/usage', rc_id: 'abc' },
    });
    expect(event.exception?.values?.[0]).toEqual({ type: 'TypeError', value: '' });
    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();
    expect(event.breadcrumbs).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.message).toBeUndefined();
    expect(event.contexts).toEqual({ trace: { trace_id: 'a' } });
    expect(event.tags).toEqual({ route: '/v1/usage' });
  });

  it('is off without a DSN and samples low in production', () => {
    expect(sentryOptions({ WORKER_ENV: 'test' } as Env).dsn).toBeUndefined();
    expect(tracesSampleRateFor('production')).toBe(0.1);
    expect(tracesSampleRateFor('local')).toBe(0);
  });
});
