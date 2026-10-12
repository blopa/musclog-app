import type { GymSnapshot } from '../gym';
import { defaultPlates } from '../gym';
import { incrementFor, weightInputStep } from '../loadIncrement';

const gym: GymSnapshot = {
  id: 'g',
  name: 'Home',
  barWeightKg: 20,
  plates: [
    { weightKg: 10, count: 4 },
    { weightKg: 2.5, count: 4 },
  ],
  weightIncrementKg: 2,
  equipment: ['barbell', 'dumbbell'],
};

describe('incrementFor', () => {
  it('uses the app default with no gym', () => {
    expect(incrementFor('barbell', null, 'metric')).toBe(2.5);
    expect(incrementFor('dumbbell', undefined, 'imperial')).toBeCloseTo(2.268, 2);
  });

  it('moves a barbell by one pair of the lightest plate', () => {
    expect(incrementFor('barbell', gym, 'metric')).toBe(5);
    expect(incrementFor('smith_machine', gym, 'metric')).toBe(5);
    expect(incrementFor('barbell', { ...gym, plates: defaultPlates('metric') }, 'metric')).toBe(
      2.5
    );
  });

  it('ignores a lone plate that cannot be loaded as a pair', () => {
    const odd = {
      ...gym,
      plates: [
        { weightKg: 1.25, count: 1 },
        { weightKg: 5, count: 2 },
      ],
    };
    expect(incrementFor('barbell', odd, 'metric')).toBe(10);
  });

  it('uses the gym increment for everything that is not bar-loaded', () => {
    expect(incrementFor('dumbbell', gym, 'metric')).toBe(2);
    expect(incrementFor('cable', gym, 'metric')).toBe(2);
    expect(incrementFor(undefined, gym, 'metric')).toBe(2);
  });

  it('falls back to the gym increment when it owns no pairs of plates', () => {
    expect(incrementFor('barbell', { ...gym, plates: [] }, 'metric')).toBe(2);
  });
});

describe('weightInputStep', () => {
  it('keeps the legacy half-unit step without a gym', () => {
    expect(weightInputStep('barbell', null, 'metric')).toBe(0.5);
    expect(weightInputStep('barbell', null, 'imperial')).toBe(0.5);
  });

  it('steps by the increment, in the unit the input shows', () => {
    expect(weightInputStep('barbell', gym, 'metric')).toBe(5);
    expect(weightInputStep('dumbbell', gym, 'metric')).toBe(2);

    const imperial: GymSnapshot = {
      ...gym,
      plates: defaultPlates('imperial'),
      weightIncrementKg: 2.2679,
    };
    expect(weightInputStep('barbell', imperial, 'imperial')).toBe(5); // 2 × 2.5 lb
    expect(weightInputStep('dumbbell', imperial, 'imperial')).toBe(5);
  });
});
