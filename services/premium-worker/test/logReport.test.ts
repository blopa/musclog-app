import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeLogEvent,
  REPORT_INTERVAL_MS,
  REPORTED_ERROR_CODES,
  resetLogReportThrottle,
  sentryLogger,
  shouldReport,
} from '../src/logReport';
import { ALLOWED_TAGS } from '../src/sentry';
import type { Logger, LogEvent } from '../src/log';

const base = { route: '/v1/chat/completions', status: 503 };

function recorder(): Logger & { events: LogEvent[] } {
  const events: LogEvent[] = [];
  return { events, log: (e) => void events.push(e) };
}

describe('shouldReport', () => {
  it('reports every high event', () => {
    expect(shouldReport({ ...base, code: 'config_invalid', severity: 'high' })).toBe(true);
  });

  it('reports only the error codes that are faults', () => {
    expect(shouldReport({ ...base, code: 'otari_provider_unverified', severity: 'error' })).toBe(
      true
    );
    expect(shouldReport({ ...base, code: 'settle_failed', severity: 'error' })).toBe(true);
    expect(shouldReport({ ...base, code: 'hosted_disabled', severity: 'error' })).toBe(false);
  });

  it('does not report info or events without a severity', () => {
    expect(shouldReport({ ...base, code: 'settle_failed', severity: 'info' })).toBe(false);
    expect(shouldReport({ ...base, code: 'settle_failed' })).toBe(false);
  });

  it('lists exactly the two fault codes', () => {
    expect([...REPORTED_ERROR_CODES].sort()).toEqual([
      'otari_provider_unverified',
      'settle_failed',
    ]);
  });
});

describe('describeLogEvent', () => {
  it('keeps only the allowed tags and names the signal by its code', () => {
    const event: LogEvent = {
      route: '/v1/chat/completions',
      status: 503,
      code: 'upstream_unexpected_provider',
      severity: 'high',
      upstream: 'otari',
      lineage_prefix: 'abcd1234',
      model: 'x',
      tokens: 5,
      cost_u: 9,
    };
    const described = describeLogEvent(event);
    expect(described.name).toBe('upstream_unexpected_provider');
    expect(described.tags).toEqual({
      route: '/v1/chat/completions',
      status: '503',
      code: 'upstream_unexpected_provider',
      severity: 'high',
      upstream: 'otari',
    });
    for (const key of Object.keys(described.tags)) {
      expect(ALLOWED_TAGS.has(key)).toBe(true);
    }
    expect(described.fingerprint).toEqual([
      'premium-worker',
      '/v1/chat/completions',
      'upstream_unexpected_provider',
    ]);
  });

  it('omits upstream when absent and defaults the name and severity', () => {
    const described = describeLogEvent({ ...base });
    expect(described.name).toBe('unknown');
    expect(described.tags).toEqual({
      route: '/v1/chat/completions',
      status: '503',
      code: 'unknown',
      severity: 'info',
    });
  });
});

describe('sentryLogger', () => {
  beforeEach(() => resetLogReportThrottle());

  it('passes every event to the inner logger', () => {
    const inner = recorder();
    const send = vi.fn();
    const logger = sentryLogger(inner, send, () => 0);
    logger.log({ ...base, code: 'hosted_disabled', severity: 'error' });
    logger.log({ ...base, code: 'other', severity: 'info' });
    expect(inner.events).toHaveLength(2);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends a reportable event once, then again only after the interval', () => {
    const inner = recorder();
    const send = vi.fn();
    let now = 1_000;
    const logger = sentryLogger(inner, send, () => now);
    const event: LogEvent = { ...base, code: 'settle_failed', severity: 'error' };

    logger.log(event);
    now += 1_000;
    logger.log(event);
    expect(send).toHaveBeenCalledTimes(1);
    expect(inner.events).toHaveLength(2);

    now = 1_000 + REPORT_INTERVAL_MS;
    logger.log(event);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('throttles by route and code, so a different code is sent', () => {
    const inner = recorder();
    const send = vi.fn();
    const logger = sentryLogger(inner, send, () => 0);
    logger.log({ ...base, code: 'settle_failed', severity: 'error' });
    logger.log({ ...base, code: 'otari_provider_unverified', severity: 'error' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('never throws out of log when send throws', () => {
    const inner = recorder();
    const logger = sentryLogger(
      inner,
      () => {
        throw new Error('sentry down');
      },
      () => 0
    );
    expect(() => logger.log({ ...base, code: 'config_invalid', severity: 'high' })).not.toThrow();
    expect(inner.events).toHaveLength(1);
  });
});
