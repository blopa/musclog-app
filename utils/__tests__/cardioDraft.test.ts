import { buildCardioDraft } from '@/utils/cardioDraft';

const base = { distance: 5, hours: 0, minutes: 30, seconds: 0, units: 'metric' as const };

describe('buildCardioDraft', () => {
  it('converts kilometres and a three-field duration to metres and seconds', () => {
    expect(buildCardioDraft(base)).toEqual({ distanceM: 5000, durationS: 1800, isValid: true });
  });

  it('converts miles', () => {
    const draft = buildCardioDraft({ ...base, distance: 1, units: 'imperial' });
    expect(draft.distanceM).toBeCloseTo(1609.344, 6);
  });

  it('adds hours, minutes and seconds together', () => {
    expect(buildCardioDraft({ ...base, hours: 1, minutes: 2, seconds: 3 }).durationS).toBe(3723);
  });

  it('is not valid without a distance or without a duration', () => {
    expect(buildCardioDraft({ ...base, distance: 0 }).isValid).toBe(false);
    expect(buildCardioDraft({ ...base, minutes: 0 }).isValid).toBe(false);
  });

  it('treats NaN, Infinity and negatives as zero instead of leaking them', () => {
    const draft = buildCardioDraft({
      distance: Number.NaN,
      hours: Number.POSITIVE_INFINITY,
      minutes: -5,
      seconds: Number.NaN,
      units: 'metric',
    });
    expect(draft).toEqual({ distanceM: 0, durationS: 0, isValid: false });
  });

  it('refuses more than a day', () => {
    expect(buildCardioDraft({ ...base, hours: 24, minutes: 0 }).isValid).toBe(true);
    expect(buildCardioDraft({ ...base, hours: 24, minutes: 0, seconds: 1 }).isValid).toBe(false);
  });
});
