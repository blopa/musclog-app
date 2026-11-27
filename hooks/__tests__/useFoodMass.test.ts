import { renderHook } from '@testing-library/react';

import { useFoodMass } from '@/hooks/useFoodMass';

let mockUnits: 'metric' | 'imperial' = 'metric';

jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ units: mockUnits }),
}));
jest.mock('@/hooks/useFormatAppNumber', () => ({
  useFormatAppNumber: () => ({ locale: 'en-US' }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'food.unitOz' ? 'oz' : key === 'food.unitGrams' ? 'g' : key),
  }),
}));

function mass(units: 'metric' | 'imperial') {
  mockUnits = units;
  const { result } = renderHook(() => useFoodMass());

  return result.current;
}

describe('useFoodMass', () => {
  afterEach(() => {
    mockUnits = 'metric';
  });

  it('formats grams in metric with the gram label and no decimals', () => {
    const food = mass('metric');

    expect(food.unitLabel).toBe('g');
    expect(food.fractionDigits).toBe(0);
    expect(food.formatMass(100)).toBe('100 g');
  });

  it('formats grams in imperial as ounces with one decimal', () => {
    const food = mass('imperial');

    expect(food.unitLabel).toBe('oz');
    expect(food.fractionDigits).toBe(1);
    expect(food.formatMass(100)).toBe('3.5 oz');
  });

  it('shows and accepts the same grams in metric', () => {
    const food = mass('metric');

    expect(food.toDisplay(100)).toBe(100);
    expect(food.fromDisplay(100)).toBe(100);
  });

  it('shows and accepts ounces in imperial', () => {
    const food = mass('imperial');

    expect(food.toDisplay(100)).toBeCloseTo(3.527, 2);
    expect(food.fromDisplay(1)).toBeCloseTo(28.35, 1);
  });

  it('steps by the given gram amount in metric', () => {
    const food = mass('metric');

    expect(food.stepGrams()).toBe(1);
    expect(food.stepGrams(10)).toBe(10);
  });

  it('steps by half an ounce in imperial, whatever the metric step', () => {
    const food = mass('imperial');

    expect(food.stepGrams()).toBeCloseTo(14.17, 1);
    expect(food.stepGrams(10)).toBeCloseTo(14.17, 1);
  });

  it('keeps the stored grams when the shown ounces did not change', () => {
    const food = mass('imperial');

    expect(food.gramsAfterEdit(100, 3.5)).toBe(100);
  });

  it('converts the typed ounces to grams when the shown value changed', () => {
    const food = mass('imperial');

    expect(food.gramsAfterEdit(100, 4)).toBeCloseTo(113.4, 1);
  });

  it('in metric takes the typed grams as they are', () => {
    const food = mass('metric');

    expect(food.gramsAfterEdit(100, 100)).toBe(100);
    expect(food.gramsAfterEdit(100, 250)).toBe(250);
  });
});
