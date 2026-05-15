import { calculateProgress } from '../utils';

describe('DailySummaryCard utils', () => {
  it('shows 100 percent when goal and consumption are both zero', () => {
    expect(calculateProgress(0, 0)).toBe(100);
  });

  it('shows infinity when goal is zero and consumption is positive', () => {
    expect(calculateProgress(10, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});
