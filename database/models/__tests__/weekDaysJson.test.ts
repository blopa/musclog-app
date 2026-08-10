import { sanitizeWeekDaysJson } from '@/database/models/weekDaysJson';

describe('sanitizeWeekDaysJson', () => {
  it('returns undefined for nullish compatibility values', () => {
    expect(sanitizeWeekDaysJson(null)).toBeUndefined();
    expect(sanitizeWeekDaysJson(undefined)).toBeUndefined();
  });

  it('deduplicates and sorts valid weekdays', () => {
    expect(sanitizeWeekDaysJson([6, 0, 2, 2])).toEqual([0, 2, 6]);
  });

  it.each([{}, 'Monday', 1])('rejects non-array input %#', (value) => {
    expect(() => sanitizeWeekDaysJson(value)).toThrow('week_days_json must be an array');
  });

  it.each([[[-1]], [[7]], [[1.5]], [['1']], [[null]]])('rejects an invalid weekday %#', (value) => {
    expect(() => sanitizeWeekDaysJson(value)).toThrow('must be an integer between 0');
  });
});
