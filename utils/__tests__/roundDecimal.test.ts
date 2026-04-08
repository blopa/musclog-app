import { roundToDecimalPlaces } from '@/utils/roundDecimal';

describe('roundToDecimalPlaces', () => {
  it('rounds to 2 decimal places by default', () => {
    expect(roundToDecimalPlaces(789.824)).toBe(789.82);
    expect(roundToDecimalPlaces(107.415)).toBe(107.42);
  });

  it('supports other precisions', () => {
    expect(roundToDecimalPlaces(1.2345, 1)).toBe(1.2);
    expect(roundToDecimalPlaces(1.2345, 3)).toBe(1.235);
  });

  it('handles integers and zero', () => {
    expect(roundToDecimalPlaces(100)).toBe(100);
    expect(roundToDecimalPlaces(0)).toBe(0);
  });
});
