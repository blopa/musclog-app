import { getPastPeriodQuickDates } from '@/utils/cycleUtils';

const t = jest.fn(
  (key: string, opts?: Record<string, unknown>) => `${key}:${opts ? opts.count : ''}`
);

const DAY_MS = 24 * 60 * 60 * 1000;

describe('getPastPeriodQuickDates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Mid-afternoon so a "start of local day" result is unambiguously earlier than `now`.
    jest.setSystemTime(new Date(2026, 4, 20, 15, 30, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers 4, 8 and 12 weeks ago, in that order', () => {
    const quickDates = getPastPeriodQuickDates(t);

    expect(quickDates).toHaveLength(3);
    expect(quickDates.map((q) => q.label)).toEqual([
      'common.weeksAgo:4',
      'common.weeksAgo:8',
      'common.weeksAgo:12',
    ]);
    expect(t).toHaveBeenNthCalledWith(1, 'common.weeksAgo', { count: 4 });
    expect(t).toHaveBeenNthCalledWith(2, 'common.weeksAgo', { count: 8 });
    expect(t).toHaveBeenNthCalledWith(3, 'common.weeksAgo', { count: 12 });
  });

  it('subtracts exactly 4/8/12 weeks from today', () => {
    const quickDates = getPastPeriodQuickDates(t);

    expect(quickDates[0].date.getFullYear()).toBe(2026);
    expect(quickDates[0].date.getMonth()).toBe(3); // April
    expect(quickDates[0].date.getDate()).toBe(22);
    expect(quickDates[1].date.getDate()).toBe(25);
    expect(quickDates[1].date.getMonth()).toBe(2); // March
    expect(quickDates[2].date.getDate()).toBe(25);
    expect(quickDates[2].date.getMonth()).toBe(1); // February
  });

  // These feed a date picker, which must receive a clean local calendar day — a stray
  // time-of-day would leak into the stored cycle start date.
  it('returns local midnight, never the current time of day', () => {
    for (const { date } of getPastPeriodQuickDates(t)) {
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
      expect(date.getMilliseconds()).toBe(0);
    }
  });

  // Whole weeks back must land on the same weekday and stay at local midnight even across a
  // DST boundary — which is why this uses date-fns `subWeeks` rather than n * 7 * 86_400_000.
  // (2026-05-20 minus 8/12 weeks crosses the spring-forward transition in DST timezones, so the
  // raw millisecond delta is deliberately NOT a flat 28 days.)
  it('keeps the same weekday and local midnight across a DST transition', () => {
    const quickDates = getPastPeriodQuickDates(t);
    const todayWeekday = new Date().getDay();

    for (const { date } of quickDates) {
      expect(date.getDay()).toBe(todayWeekday);
      expect(date.getHours()).toBe(0);
    }

    const [four, eight, twelve] = quickDates;
    expect(four.date.getTime() - eight.date.getTime()).toBeGreaterThanOrEqual(27 * DAY_MS);
    expect(four.date.getTime() - eight.date.getTime()).toBeLessThanOrEqual(29 * DAY_MS);
    expect(eight.date.getTime() - twelve.date.getTime()).toBeGreaterThanOrEqual(27 * DAY_MS);
    expect(eight.date.getTime() - twelve.date.getTime()).toBeLessThanOrEqual(29 * DAY_MS);
  });

  it('always returns dates in the past', () => {
    const now = Date.now();

    for (const { date } of getPastPeriodQuickDates(t)) {
      expect(date.getTime()).toBeLessThan(now);
    }
  });
});
