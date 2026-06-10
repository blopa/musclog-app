import {
  bucketPointsByUtcWeek,
  calendarDateFromRecordDay,
  dayKeyForCalendarDateInTimezone,
  isUtcDayKeyInRange,
  MS_PER_SOLAR_DAY,
  TIMEZONE_QUERY_BUFFER_MS,
  timezoneWidenedBounds,
  utcDayKeyFromLocalDate,
  utcNormalizedDayKey,
  utcWeekIndex,
} from '@/utils/calendarDate';
import {
  getCurrentTimezone,
  getTimezoneAt,
  ianaZoneToTimezoneAt,
  isTimezoneOffset,
  normalizeTimezoneToOffset,
  offsetMinutesToTimezone,
} from '@/utils/timezone';

describe('offsetMinutesToTimezone', () => {
  it('formats UTC as +00:00', () => {
    expect(offsetMinutesToTimezone(0)).toBe('+00:00');
  });

  it('formats positive (east of UTC) offsets with a + sign', () => {
    expect(offsetMinutesToTimezone(60)).toBe('+01:00');
    expect(offsetMinutesToTimezone(330)).toBe('+05:30'); // India
    expect(offsetMinutesToTimezone(840)).toBe('+14:00'); // Kiribati
  });

  it('formats negative (west of UTC) offsets with a - sign', () => {
    expect(offsetMinutesToTimezone(-300)).toBe('-05:00'); // US Eastern (winter)
    expect(offsetMinutesToTimezone(-210)).toBe('-03:30'); // Newfoundland
    expect(offsetMinutesToTimezone(-720)).toBe('-12:00');
  });

  it('zero-pads single-digit hours and minutes', () => {
    expect(offsetMinutesToTimezone(5)).toBe('+00:05');
    expect(offsetMinutesToTimezone(-5)).toBe('-00:05');
  });

  it('truncates fractional minutes toward zero', () => {
    expect(offsetMinutesToTimezone(90.9)).toBe('+01:30');
    expect(offsetMinutesToTimezone(-90.9)).toBe('-01:30');
  });

  it('always round-trips to a valid offset string', () => {
    for (let m = -14 * 60; m <= 14 * 60; m += 15) {
      expect(isTimezoneOffset(offsetMinutesToTimezone(m))).toBe(true);
    }
  });
});

describe('isTimezoneOffset', () => {
  it('accepts canonical ±HH:MM strings', () => {
    expect(isTimezoneOffset('+00:00')).toBe(true);
    expect(isTimezoneOffset('-05:00')).toBe(true);
    expect(isTimezoneOffset('+05:30')).toBe(true);
  });

  it('rejects IANA zone names and bare labels', () => {
    expect(isTimezoneOffset('America/New_York')).toBe(false);
    expect(isTimezoneOffset('UTC')).toBe(false);
    expect(isTimezoneOffset('GMT')).toBe(false);
  });

  it('rejects malformed offsets', () => {
    expect(isTimezoneOffset('')).toBe(false);
    expect(isTimezoneOffset('+5:00')).toBe(false); // hours not zero-padded
    expect(isTimezoneOffset('05:00')).toBe(false); // missing sign
    expect(isTimezoneOffset('-05:00:00')).toBe(false); // seconds component
    expect(isTimezoneOffset('+0500')).toBe(false); // missing colon
  });
});

describe('ianaZoneToTimezoneAt', () => {
  it('resolves a fixed-offset zone (no DST)', () => {
    const date = new Date('2023-07-15T12:00:00Z');
    expect(ianaZoneToTimezoneAt('Asia/Kolkata', date)).toBe('+05:30');
    expect(ianaZoneToTimezoneAt('UTC', date)).toBe('+00:00');
  });

  it('is DST-aware — the same zone resolves differently per instant', () => {
    const winter = new Date('2023-01-15T12:00:00Z');
    const summer = new Date('2023-07-15T12:00:00Z');
    expect(ianaZoneToTimezoneAt('America/New_York', winter)).toBe('-05:00'); // EST
    expect(ianaZoneToTimezoneAt('America/New_York', summer)).toBe('-04:00'); // EDT
  });

  it('returns undefined for an unresolvable zone', () => {
    expect(ianaZoneToTimezoneAt('Not/ARealZone', new Date('2023-01-15T12:00:00Z'))).toBeUndefined();
  });
});

describe('normalizeTimezoneToOffset', () => {
  const date = new Date('2023-01-15T12:00:00Z');

  it('passes through values already in offset form', () => {
    expect(normalizeTimezoneToOffset('-05:00', date)).toBe('-05:00');
    expect(normalizeTimezoneToOffset('+05:30', date)).toBe('+05:30');
  });

  it('converts IANA zone names to the DST-aware offset at the given instant', () => {
    expect(normalizeTimezoneToOffset('America/New_York', date)).toBe('-05:00');
    expect(normalizeTimezoneToOffset('UTC', date)).toBe('+00:00');
  });

  it('returns empty input unchanged', () => {
    expect(normalizeTimezoneToOffset('', date)).toBe('');
  });

  it('falls back to the original value when the zone cannot be resolved', () => {
    expect(normalizeTimezoneToOffset('Bogus/Zone', date)).toBe('Bogus/Zone');
  });
});

describe('getCurrentTimezone', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('negates getTimezoneOffset() so west-of-UTC zones are negative', () => {
    // getTimezoneOffset() returns minutes behind UTC: UTC-5 → +300.
    jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(300);
    expect(getCurrentTimezone()).toBe('-05:00');
  });

  it('handles east-of-UTC half-hour zones', () => {
    // UTC+5:30 → getTimezoneOffset() returns -330.
    jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-330);
    expect(getCurrentTimezone()).toBe('+05:30');
  });

  it('formats UTC as +00:00', () => {
    jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);
    expect(getCurrentTimezone()).toBe('+00:00');
  });

  it('returns a valid offset string on the real host', () => {
    expect(isTimezoneOffset(getCurrentTimezone())).toBe(true);
  });
});

describe('getTimezoneAt', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the offset from the provided date, not the current instant', () => {
    const spy = jest.spyOn(Date.prototype, 'getTimezoneOffset');
    spy.mockReturnValueOnce(300);
    expect(getTimezoneAt(new Date('2025-01-15T12:00:00Z'))).toBe('-05:00');
    spy.mockReturnValueOnce(240);
    expect(getTimezoneAt(new Date('2025-07-15T12:00:00Z'))).toBe('-04:00');
  });
});

describe('utcNormalizedDayKey', () => {
  // Jan 15 2025 00:00 UTC+1 (Amsterdam) stored as Jan 14 23:00 UTC
  const amsterdamJan15Date = Date.UTC(2025, 0, 14, 23, 0, 0); // 1736895600000

  // Jan 15 2025 00:00 UTC-3 (Brazil) stored as Jan 15 03:00 UTC
  const brazilJan15Date = Date.UTC(2025, 0, 15, 3, 0, 0); // 1736913600000

  // Jan 15 2025 00:00 UTC+0 stored as Jan 15 00:00 UTC
  const utcJan15Date = Date.UTC(2025, 0, 15, 0, 0, 0); // 1736899200000

  const jan15UtcMidnight = Date.UTC(2025, 0, 15); // expected normalized key

  it('normalizes Amsterdam +01:00 Jan 15 date to Jan 15 UTC midnight', () => {
    expect(utcNormalizedDayKey(amsterdamJan15Date, '+01:00')).toBe(jan15UtcMidnight);
  });

  it('normalizes Brazil -03:00 Jan 15 date to Jan 15 UTC midnight', () => {
    expect(utcNormalizedDayKey(brazilJan15Date, '-03:00')).toBe(jan15UtcMidnight);
  });

  it('normalizes UTC +00:00 Jan 15 date to Jan 15 UTC midnight', () => {
    expect(utcNormalizedDayKey(utcJan15Date, '+00:00')).toBe(jan15UtcMidnight);
  });

  it('Amsterdam and Brazil Jan 15 logs produce the same normalized key', () => {
    expect(utcNormalizedDayKey(amsterdamJan15Date, '+01:00')).toBe(
      utcNormalizedDayKey(brazilJan15Date, '-03:00')
    );
  });

  it('correctly distinguishes consecutive days', () => {
    // Jan 16 Amsterdam: Jan 15 23:00 UTC
    const amsterdamJan16Date = Date.UTC(2025, 0, 15, 23, 0, 0);
    const jan16UtcMidnight = Date.UTC(2025, 0, 16);
    expect(utcNormalizedDayKey(amsterdamJan16Date, '+01:00')).toBe(jan16UtcMidnight);
    expect(utcNormalizedDayKey(amsterdamJan16Date, '+01:00')).not.toBe(jan15UtcMidnight);
  });

  it('falls back to device-local date when timezone is null', () => {
    // Null timezone intentionally falls back to the host/device local calendar date.
    const result = utcNormalizedDayKey(amsterdamJan15Date, null);
    const local = new Date(amsterdamJan15Date);
    expect(result).toBe(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  });

  it('handles arbitrary timestamps within a day (not just midnight)', () => {
    // 8 AM Amsterdam Jan 15 = Jan 15 07:00 UTC
    const amsterdamJan15Morning = Date.UTC(2025, 0, 15, 7, 0, 0);
    expect(utcNormalizedDayKey(amsterdamJan15Morning, '+01:00')).toBe(jan15UtcMidnight);

    // 11:50 PM Amsterdam Jan 15 = Jan 15 22:50 UTC
    const amsterdamJan15LateNight = Date.UTC(2025, 0, 15, 22, 50, 0);
    expect(utcNormalizedDayKey(amsterdamJan15LateNight, '+01:00')).toBe(jan15UtcMidnight);
  });
});

describe('record calendar day helpers', () => {
  it('creates picker-safe local dates from a stored record timezone', () => {
    const amsterdamJan15Date = Date.UTC(2025, 0, 14, 23, 0, 0);
    const pickerDate = calendarDateFromRecordDay(amsterdamJan15Date, '+01:00');

    expect(pickerDate.getFullYear()).toBe(2025);
    expect(pickerDate.getMonth()).toBe(0);
    expect(pickerDate.getDate()).toBe(15);
  });

  it('round-trips a picker calendar date back to the same timezone-specific day key', () => {
    const pickerDate = new Date(2025, 0, 15);

    expect(dayKeyForCalendarDateInTimezone(pickerDate, '+01:00')).toBe(
      Date.UTC(2025, 0, 14, 23, 0, 0)
    );
    expect(dayKeyForCalendarDateInTimezone(pickerDate, '-03:00')).toBe(
      Date.UTC(2025, 0, 15, 3, 0, 0)
    );
  });
});

describe('utcDayKeyFromLocalDate', () => {
  it('returns the UTC midnight key for the picked local calendar day', () => {
    expect(utcDayKeyFromLocalDate(new Date(2025, 0, 15, 18, 30))).toBe(Date.UTC(2025, 0, 15));
  });

  it('anchors the same key that utcNormalizedDayKey produces for a record on that day', () => {
    // A picker for Jan 15 must compare equal to a record on Jan 15 in any timezone.
    const picked = utcDayKeyFromLocalDate(new Date(2025, 0, 15));
    expect(utcNormalizedDayKey(Date.UTC(2025, 0, 14, 23, 0, 0), '+01:00')).toBe(picked);
    expect(utcNormalizedDayKey(Date.UTC(2025, 0, 15, 3, 0, 0), '-03:00')).toBe(picked);
  });
});

describe('timezoneWidenedBounds', () => {
  it('pads a single-day key window by ±14 h around the [start, end+1day) range', () => {
    const key = Date.UTC(2025, 0, 15);
    const { lowerMs, upperMs } = timezoneWidenedBounds(key, key);
    expect(lowerMs).toBe(key - TIMEZONE_QUERY_BUFFER_MS);
    expect(upperMs).toBe(key + MS_PER_SOLAR_DAY + TIMEZONE_QUERY_BUFFER_MS);
  });

  it('captures records stored in the extreme UTC−14…UTC+14 offsets for the target day', () => {
    const key = Date.UTC(2025, 0, 15);
    const { lowerMs, upperMs } = timezoneWidenedBounds(key, key);
    // Stored date for a Jan 15 record = key − offset; offsets span [−14h, +14h].
    const farEastStored = key - 14 * 60 * 60 * 1000; // +14:00
    const farWestStored = key + 14 * 60 * 60 * 1000; // −14:00
    expect(farEastStored).toBeGreaterThanOrEqual(lowerMs);
    expect(farWestStored).toBeLessThan(upperMs);
  });
});

describe('isUtcDayKeyInRange', () => {
  const jan15 = Date.UTC(2025, 0, 15);
  const jan16 = Date.UTC(2025, 0, 16);
  // Amsterdam (+01:00) Jan 16 stored as Jan 15 23:00 UTC — within the ±14 h overscan of Jan 15.
  const amsterdamJan16 = Date.UTC(2025, 0, 15, 23, 0, 0);

  it('matches a record on the exact single target day (inclusive default)', () => {
    expect(isUtcDayKeyInRange(Date.UTC(2025, 0, 14, 23, 0, 0), '+01:00', jan15, jan15)).toBe(true);
  });

  it('rejects an overscanned next-day record that the widened query would also return', () => {
    expect(isUtcDayKeyInRange(amsterdamJan16, '+01:00', jan15, jan15)).toBe(false);
  });

  it('honors inclusiveEnd: false (half-open) vs true (closed) on the end bound', () => {
    expect(
      isUtcDayKeyInRange(amsterdamJan16, '+01:00', jan15, jan16, { inclusiveEnd: false })
    ).toBe(false);
    expect(isUtcDayKeyInRange(amsterdamJan16, '+01:00', jan15, jan16, { inclusiveEnd: true })).toBe(
      true
    );
  });
});

describe('utcWeekIndex / bucketPointsByUtcWeek', () => {
  const startKey = Date.UTC(2025, 0, 1);

  it('assigns rolling 7-day bucket indices from the start key', () => {
    expect(utcWeekIndex(Date.UTC(2025, 0, 1), startKey)).toBe(0);
    expect(utcWeekIndex(Date.UTC(2025, 0, 7), startKey)).toBe(0);
    expect(utcWeekIndex(Date.UTC(2025, 0, 8), startKey)).toBe(1);
  });

  it('buckets points by each record’s OWN timezone, not a shared frame', () => {
    // Both points are Jan 8 for their own user, so both belong to week 1 — even though one is
    // stored just before and one just after the Jan 8 UTC midnight.
    const points = [
      { date: Date.UTC(2025, 0, 7, 23, 0, 0), timezone: '+01:00', valueKg: 80 }, // Amsterdam Jan 8
      { date: Date.UTC(2025, 0, 8, 3, 0, 0), timezone: '-03:00', valueKg: 82 }, // Brazil Jan 8
    ];
    const buckets = bucketPointsByUtcWeek(points, startKey);
    expect([...buckets.keys()]).toEqual([1]);
    expect(buckets.get(1)).toHaveLength(2);
  });
});
