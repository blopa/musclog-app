import { enUS } from 'date-fns/locale';

import { formatRelativeTime } from '@/utils/formatRelativeTime';

// Echoes the key plus the interpolated values so assertions can see both.
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as any;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Fixed clock: tests must never read the real one.
const NOW = new Date('2026-08-05T12:00:00Z').getTime();

const format = (timestamp: number, now = NOW) =>
  formatRelativeTime(timestamp, { t, locale: 'en-US', dateFnsLocale: enUS, now });

describe('formatRelativeTime', () => {
  it('uses the "now" bucket under a minute', () => {
    expect(format(NOW - 59_000)).toBe('common.relativeTime.now');
  });

  it('uses minutes right up to the hour boundary', () => {
    expect(format(NOW - 59 * MINUTE)).toBe('common.relativeTime.minutes:{"value":"59"}');
  });

  it('rolls over to hours at exactly one hour', () => {
    expect(format(NOW - HOUR)).toBe('common.relativeTime.hours:{"value":"1"}');
  });

  it('floors partial hours', () => {
    expect(format(NOW - 90 * MINUTE)).toBe('common.relativeTime.hours:{"value":"1"}');
  });

  it('uses hours right up to the day boundary', () => {
    expect(format(NOW - 23 * HOUR)).toBe('common.relativeTime.hours:{"value":"23"}');
  });

  it('rolls over to days at exactly one day', () => {
    expect(format(NOW - DAY)).toBe('common.relativeTime.days:{"value":"1"}');
  });

  it('uses days up to the one-week cutoff', () => {
    expect(format(NOW - 6 * DAY)).toBe('common.relativeTime.days:{"value":"6"}');
  });

  it('falls back to an absolute same-year date at one week', () => {
    expect(format(NOW - 7 * DAY)).toBe('Jul 29');
  });

  it('falls back to an absolute same-year date well past the cutoff', () => {
    expect(format(NOW - 30 * DAY)).toBe('Jul 6');
  });

  it('includes the year once the note is from a different year', () => {
    expect(format(new Date('2025-03-14T12:00:00Z').getTime())).toBe('Mar 14, 2025');
  });

  it('clamps future timestamps from clock skew to "now"', () => {
    expect(format(NOW + 5 * HOUR)).toBe('common.relativeTime.now');
  });

  it('interpolates the value as a pre-formatted string, never a raw number', () => {
    const result = format(NOW - 3 * HOUR);
    const { value } = JSON.parse(result.slice(result.indexOf(':') + 1));

    expect(typeof value).toBe('string');
  });

  it('routes the numeric part through the app number formatter for the active locale', () => {
    const result = formatRelativeTime(NOW - 45 * MINUTE, {
      t,
      locale: 'ar-EG',
      dateFnsLocale: enUS,
      now: NOW,
    });
    const { value } = JSON.parse(result.slice(result.indexOf(':') + 1));

    // ar-EG renders digits in Eastern Arabic numerals — proof the locale reached Intl.
    expect(value).not.toBe('45');
    expect(typeof value).toBe('string');
  });
});
