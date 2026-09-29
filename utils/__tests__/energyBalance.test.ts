import { computeEnergyBalance } from '../energyBalance';

describe('computeEnergyBalance', () => {
  it('computes deficit correctly', () => {
    const result = computeEnergyBalance({ burnedKcal: 2500, consumedKcal: 2000 });
    expect(result).toEqual({
      balance: 500,
      burned: 2500,
      direction: 'deficit',
      eaten: 2000,
    });
  });

  it('computes surplus correctly', () => {
    const result = computeEnergyBalance({ burnedKcal: 2500, consumedKcal: 3000 });
    expect(result).toEqual({
      balance: 500,
      burned: 2500,
      direction: 'surplus',
      eaten: 3000,
    });
  });

  it('computes even correctly', () => {
    const result = computeEnergyBalance({ burnedKcal: 2500, consumedKcal: 2500 });
    expect(result).toEqual({
      balance: 0,
      burned: 2500,
      direction: 'even',
      eaten: 2500,
    });
  });

  // The argument is kcal already burned, never a whole-day TDEE: early in the day the two
  // differ by most of the day's expenditure, and it is the burned figure the strip labels.
  it('echoes the burned figure it was given rather than a day total', () => {
    expect(computeEnergyBalance({ burnedKcal: 620, consumedKcal: 0 })).toEqual({
      balance: 620,
      burned: 620,
      direction: 'deficit',
      eaten: 0,
    });
  });
});
