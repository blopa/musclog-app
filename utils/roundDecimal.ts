/**
 * Rounds a number to a fixed number of decimal places (half-up via scaled Math.round).
 * Default 2 decimals matches common nutrition and volume display (e.g. grams, kcal, kg volume).
 */
export function roundToDecimalPlaces(value: number, decimalPlaces = 2): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}
