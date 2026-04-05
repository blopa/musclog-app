import {
  kgToLbs,
  lbsToKg,
  cmToIn,
  inToCm,
  gramsToOz,
  ozToGrams,
  prepareValueForStorage,
  prepareValueForDisplay
} from '../unitConversion';

describe('unitConversion', () => {
  test('kgToLbs', () => {
    expect(kgToLbs(1)).toBeCloseTo(2.20462);
    expect(kgToLbs(70)).toBeCloseTo(154.324);
  });

  test('lbsToKg', () => {
    expect(lbsToKg(2.20462)).toBeCloseTo(1);
    expect(lbsToKg(154.324)).toBeCloseTo(70);
  });

  test('cmToIn', () => {
    expect(cmToIn(1)).toBeCloseTo(0.393701);
    expect(cmToIn(180)).toBeCloseTo(70.8661);
  });

  test('inToCm', () => {
    expect(inToCm(0.393701)).toBeCloseTo(1);
    expect(inToCm(70.8661)).toBeCloseTo(180);
  });

  test('gramsToOz', () => {
    expect(gramsToOz(1)).toBeCloseTo(0.035274);
    expect(gramsToOz(100)).toBeCloseTo(3.5274);
  });

  test('ozToGrams', () => {
    expect(ozToGrams(0.035274)).toBeCloseTo(1);
    expect(ozToGrams(3.5274)).toBeCloseTo(100);
  });

  test('prepareValueForStorage', () => {
    // Weight
    expect(prepareValueForStorage(100, 'imperial', 'weight')).toBeCloseTo(45.3592);
    expect(prepareValueForStorage(100, 'metric', 'weight')).toBe(100);

    // Length
    expect(prepareValueForStorage(70, 'imperial', 'length')).toBeCloseTo(177.8);
    expect(prepareValueForStorage(170, 'metric', 'length')).toBe(170);

    // Food (grams)
    expect(prepareValueForStorage(3.5274, 'imperial', 'grams')).toBeCloseTo(100);
    expect(prepareValueForStorage(100, 'metric', 'grams')).toBe(100);
  });

  test('prepareValueForDisplay', () => {
    // Weight
    expect(prepareValueForDisplay(45.3592, 'imperial', 'weight')).toBeCloseTo(100);
    expect(prepareValueForDisplay(100, 'metric', 'weight')).toBe(100);

    // Length
    expect(prepareValueForDisplay(177.8, 'imperial', 'length')).toBeCloseTo(70);
    expect(prepareValueForDisplay(170, 'metric', 'length')).toBe(170);

    // Food (grams)
    expect(prepareValueForDisplay(100, 'imperial', 'grams')).toBeCloseTo(3.5274);
    expect(prepareValueForDisplay(100, 'metric', 'grams')).toBe(100);
  });
});
