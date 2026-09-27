import { computeEnergyBalance } from '../energyBalance';

describe('computeEnergyBalance', () => {
  it('computes deficit correctly', () => {
    const result = computeEnergyBalance({ tdee: 2500, consumedKcal: 2000 });
    expect(result).toEqual({
      burned: 2500,
      eaten: 2000,
      balance: 500,
      direction: 'deficit',
    });
  });

  it('computes surplus correctly', () => {
    const result = computeEnergyBalance({ tdee: 2500, consumedKcal: 3000 });
    expect(result).toEqual({
      burned: 2500,
      eaten: 3000,
      balance: 500,
      direction: 'surplus',
    });
  });

  it('computes even correctly', () => {
    const result = computeEnergyBalance({ tdee: 2500, consumedKcal: 2500 });
    expect(result).toEqual({
      burned: 2500,
      eaten: 2500,
      balance: 0,
      direction: 'even',
    });
  });
});
