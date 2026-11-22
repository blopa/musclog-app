import { formatMediumDate } from '@/utils/formatMediumDate';

describe('formatMediumDate', () => {
  it('formats a valid ISO instant for the locale', () => {
    expect(formatMediumDate('2026-12-01T00:00:00.000Z', 'en-US')).toBe(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
        new Date('2026-12-01T00:00:00.000Z')
      )
    );
  });

  it('returns null for an invalid string', () => {
    expect(formatMediumDate('not a date', 'en-US')).toBeNull();
  });

  it('returns null for null, undefined and the empty string', () => {
    expect(formatMediumDate(null, 'en-US')).toBeNull();
    expect(formatMediumDate(undefined, 'en-US')).toBeNull();
    expect(formatMediumDate('', 'en-US')).toBeNull();
  });
});
