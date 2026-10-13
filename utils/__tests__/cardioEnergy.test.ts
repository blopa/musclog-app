import {
  averageSpeedMetersPerMinute,
  estimateCardioKcal,
  isCardioActivity,
} from '@/utils/cardioEnergy';

describe('estimateCardioKcal (ACSM, level ground, gross)', () => {
  // 70 kg for 30 min.
  it('walks 3 km in 30 min: VO2 = 0.1 * 100 + 3.5 = 13.5 ml/kg/min -> 142 kcal', () => {
    // 13.5 * 70 * 30 / 1000 * 5 = 141.75
    expect(
      estimateCardioKcal({ activity: 'walk', distanceM: 3000, durationS: 1800, bodyMassKg: 70 })
    ).toBe(142);
  });

  it('runs 5 km in 30 min: VO2 = 0.2 * 166.67 + 3.5 = 36.83 -> 387 kcal', () => {
    // 36.8333 * 70 * 30 / 1000 * 5 = 386.75
    expect(
      estimateCardioKcal({ activity: 'run', distanceM: 5000, durationS: 1800, bodyMassKg: 70 })
    ).toBe(387);
  });

  it('scales linearly with body mass', () => {
    const light = estimateCardioKcal({
      activity: 'run',
      distanceM: 5000,
      durationS: 1800,
      bodyMassKg: 50,
    });
    const heavy = estimateCardioKcal({
      activity: 'run',
      distanceM: 5000,
      durationS: 1800,
      bodyMassKg: 100,
    });
    expect(heavy / light).toBeCloseTo(2, 1);
  });

  it('a run burns more than a walk over the same distance and time', () => {
    const input = { distanceM: 4000, durationS: 2400, bodyMassKg: 70 };
    expect(estimateCardioKcal({ activity: 'run', ...input })).toBeGreaterThan(
      estimateCardioKcal({ activity: 'walk', ...input })
    );
  });

  it('lets a watch figure override the estimate', () => {
    expect(
      estimateCardioKcal({
        activity: 'run',
        distanceM: 5000,
        durationS: 1800,
        bodyMassKg: 70,
        caloriesOverride: 412.4,
      })
    ).toBe(412);
  });

  it('ignores a non-positive or non-finite override', () => {
    const base = { activity: 'walk' as const, distanceM: 3000, durationS: 1800, bodyMassKg: 70 };
    expect(estimateCardioKcal({ ...base, caloriesOverride: 0 })).toBe(142);
    expect(estimateCardioKcal({ ...base, caloriesOverride: Number.NaN })).toBe(142);
  });

  it('returns 0 rather than a nonsense number when it cannot estimate', () => {
    expect(
      estimateCardioKcal({ activity: 'walk', distanceM: 3000, durationS: 0, bodyMassKg: 70 })
    ).toBe(0);
    expect(
      estimateCardioKcal({ activity: 'walk', distanceM: 3000, durationS: 1800, bodyMassKg: 0 })
    ).toBe(0);
  });

  it('still charges resting metabolism when there is no distance', () => {
    // 3.5 * 70 * 30 / 1000 * 5 = 36.75
    expect(
      estimateCardioKcal({ activity: 'walk', distanceM: 0, durationS: 1800, bodyMassKg: 70 })
    ).toBe(37);
  });
});

describe('helpers', () => {
  it('averageSpeedMetersPerMinute', () => {
    expect(averageSpeedMetersPerMinute(3000, 1800)).toBe(100);
    expect(averageSpeedMetersPerMinute(0, 1800)).toBe(0);
    expect(averageSpeedMetersPerMinute(3000, 0)).toBe(0);
  });

  it('isCardioActivity only accepts the two activities', () => {
    expect(isCardioActivity('walk')).toBe(true);
    expect(isCardioActivity('run')).toBe(true);
    expect(isCardioActivity('cycle')).toBe(false);
    expect(isCardioActivity(undefined)).toBe(false);
  });
});
