import { QUICK_ACTION_MIN_WIDTH, quickActionBasis } from '@/components/nutrition/FoodQuickActions';

describe('quickActionBasis', () => {
  it('is the minimum width at the default text size', () => {
    expect(quickActionBasis(1)).toBe(QUICK_ACTION_MIN_WIDTH);
  });

  it('grows with the OS text scale so two actions stop sharing a row on a phone', () => {
    const phoneRow = 360 - 32;
    const gap = 8;

    // Default text: two actions fit side by side.
    expect(2 * quickActionBasis(1) + gap).toBeLessThanOrEqual(phoneRow);
    // Large text: they no longer do, so each takes a row instead of breaking its label.
    expect(2 * quickActionBasis(1.3) + gap).toBeGreaterThan(phoneRow);
  });

  it('never shrinks below the minimum for a scale under 1', () => {
    expect(quickActionBasis(0.85)).toBe(QUICK_ACTION_MIN_WIDTH);
  });
});
