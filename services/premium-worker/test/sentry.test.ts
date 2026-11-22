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

  it('drops child spans: an outgoing RevenueCat call names the device id in its URL', () => {
    const rcId = 'mlg1_' + 'a'.repeat(64);
    const event = scrubEvent({
      spans: [
        {
          op: 'http.client',
          description: `GET https://api.revenuecat.com/v2/projects/p/customers/${rcId}/subscriptions`,
          data: { 'url.full': `https://api.revenuecat.com/v2/projects/p/customers/${rcId}` },
        },
      ],
      contexts: {
        trace: {
          trace_id: 'a',
          span_id: 'b',
          op: 'http.server',
          status: 'ok',
          data: { 'url.full': 'https://ai.musclog.app/v1/usage', 'client.address': '1.2.3.4' },
        },
      },
    });
    expect(event.spans).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain(rcId);
    expect(JSON.stringify(event)).not.toContain('1.2.3.4');
    expect(event.contexts).toEqual({
      trace: { trace_id: 'a', span_id: 'b', op: 'http.server', status: 'ok' },
    });
  });

  it('removes the SDK fetch integration and propagates traces to nothing', () => {
    const options = sentryOptions({ WORKER_ENV: 'production' } as Env);
    expect(options.tracePropagationTargets).toEqual([]);
    const integrations = options.integrations;
    expect(typeof integrations).toBe('function');
    const kept = (integrations as (d: { name: string }[]) => { name: string }[])([
      { name: 'Fetch' },
      { name: 'Dedupe' },
    ]);
    expect(kept.map((i) => i.name)).toEqual(['Dedupe']);
  });
});
