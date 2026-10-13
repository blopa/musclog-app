import { formatDistance, formatMinutesSeconds, formatPace } from '@/utils/cardioFormat';

describe('cardio formatting', () => {
  it('formats distance in the user unit with at most two decimals', () => {
    expect(formatDistance('en-US', 5000, 'metric')).toBe('5 km');
    expect(formatDistance('en-US', 5230, 'metric')).toBe('5.23 km');
    expect(formatDistance('en-US', 1609.344, 'imperial')).toBe('1 mi');
  });

  it('uses the locale decimal separator', () => {
    expect(formatDistance('de-DE', 5230, 'metric')).toBe('5,23 km');
    expect(formatDistance('pt-BR', 5230, 'metric')).toBe('5,23 km');
  });

  it('formats m:ss with a padded seconds field', () => {
    expect(formatMinutesSeconds('en-US', 300)).toBe('5:00');
    expect(formatMinutesSeconds('en-US', 305)).toBe('5:05');
    expect(formatMinutesSeconds('en-US', 59.6)).toBe('1:00');
  });

  it('formats pace per kilometre and per mile', () => {
    expect(formatPace('en-US', 5000, 1500, 'metric')).toBe('5:00 /km');
    expect(formatPace('en-US', 5000, 1500, 'imperial')).toBe('8:03 /mi');
  });

  it('has no pace to show without a distance or duration', () => {
    expect(formatPace('en-US', 0, 1500, 'metric')).toBeNull();
    expect(formatPace('en-US', 5000, 0, 'metric')).toBeNull();
  });
});
