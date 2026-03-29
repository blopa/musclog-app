import { addDays } from 'date-fns';

import {
  localDayClosedRangeMaxMs,
  localDayHalfOpenRange,
  localDayKeyPlusCalendarDays,
  localDayStartFromUtcMs,
  localDayStartMs,
  localDayStartMsFromIsoDateOnly,
  localNextDayStartMsFromDate,
  parseLocalCalendarDate,
} from '../calendarDate';

describe('calendarDate', () => {
  it('parseLocalCalendarDate: yyyy-MM-dd matches local start of that calendar day', () => {
    const iso = '2026-06-15';
    expect(parseLocalCalendarDate(iso).getTime()).toBe(localDayStartMs(new Date(2026, 5, 15, 12, 0, 0)));
    expect(localDayStartMsFromIsoDateOnly(iso)).toBe(localDayStartMs(parseLocalCalendarDate(iso)));
  });

  it('localDayStartMs: same calendar day yields same value', () => {
    const base = new Date(2026, 2, 15, 14, 30, 0);
    const morning = new Date(2026, 2, 15, 8, 0, 0);
    expect(localDayStartMs(base)).toBe(localDayStartMs(morning));
  });

  it('localDayStartFromUtcMs normalizes instants to local day start', () => {
    const noon = new Date(2026, 5, 1, 12, 0, 0).getTime();
    const start = new Date(2026, 5, 1, 0, 0, 0).getTime();
    expect(localDayStartFromUtcMs(noon)).toBe(start);
  });

  it('localDayHalfOpenRange: start < nextStart and next is next calendar day', () => {
    const d = new Date(2026, 0, 10, 12, 0, 0);
    const { start, nextStart } = localDayHalfOpenRange(d);
    expect(start).toBeLessThan(nextStart);
    expect(nextStart).toBe(localDayStartMs(addDays(d, 1)));
  });

  it('localNextDayStartMsFromDate matches addDays(startOfDay)', () => {
    const d = new Date(2026, 0, 10, 23, 59, 59);
    expect(localNextDayStartMsFromDate(d)).toBe(localDayStartMs(addDays(d, 1)));
  });

  it('localDayClosedRangeMaxMs is nextStart - 1', () => {
    const d = new Date(2026, 0, 10, 0, 0, 0);
    const { nextStart } = localDayHalfOpenRange(d);
    expect(localDayClosedRangeMaxMs(d)).toBe(nextStart - 1);
  });

  it('localDayKeyPlusCalendarDays moves by calendar days, not fixed 24h blocks', () => {
    const day = localDayStartMs(new Date(2026, 2, 15, 12, 0, 0));
    expect(localDayKeyPlusCalendarDays(day, -7)).toBe(localDayStartMs(new Date(2026, 2, 8, 0, 0, 0)));
    expect(localDayKeyPlusCalendarDays(day, 1)).toBe(localDayStartMs(new Date(2026, 2, 16, 0, 0, 0)));
  });
});
