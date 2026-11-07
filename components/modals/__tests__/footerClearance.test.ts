import { footerClearance } from '../footerClearance';

const MINIMUM = 120;
const GAP = 8;

describe('footerClearance', () => {
  it('keeps the old fixed room until the footer has been measured', () => {
    expect(footerClearance(0, MINIMUM, GAP)).toBe(MINIMUM);
  });

  it('leaves a one-row footer exactly as it was', () => {
    // A single button row measures about 100px: the minimum already covers it plus the gap.
    expect(footerClearance(100, MINIMUM, GAP)).toBe(MINIMUM);
    expect(footerClearance(MINIMUM - GAP, MINIMUM, GAP)).toBe(MINIMUM);
  });

  it('grows with a footer that wraps, so the last row of content stays clear of it', () => {
    // Skip + Back + Next stacked at large text: far taller than the one-row minimum.
    const stacked = 232;
    expect(footerClearance(stacked, MINIMUM, GAP)).toBe(stacked + GAP);
    expect(footerClearance(stacked, MINIMUM, GAP)).toBeGreaterThan(stacked);
  });

  it('never asks for less than the minimum, and ignores a bad measurement', () => {
    expect(footerClearance(1, MINIMUM, GAP)).toBe(MINIMUM);
    expect(footerClearance(-5, MINIMUM, GAP)).toBe(MINIMUM);
    expect(footerClearance(Number.NaN, MINIMUM, GAP)).toBe(MINIMUM);
    expect(footerClearance(Number.POSITIVE_INFINITY, MINIMUM, GAP)).toBe(MINIMUM);
  });
});
