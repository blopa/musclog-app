import {
  getCurrentTimezone,
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
