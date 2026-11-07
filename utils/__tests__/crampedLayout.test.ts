import { CRAMPED_EFFECTIVE_WIDTH, isCrampedLayout } from '@/utils/crampedLayout';

describe('isCrampedLayout', () => {
  it('is false for the phones the app is designed for at the default text size', () => {
    expect(isCrampedLayout(344, 1)).toBe(false);
    expect(isCrampedLayout(360, 1)).toBe(false);
    expect(isCrampedLayout(412, 1)).toBe(false);
  });

  it('is true when large text leaves a phone under the threshold, however it arrives', () => {
    // Native: the width stays and the scale grows. Web and the audit: the layout narrows.
    expect(isCrampedLayout(360, 1.3)).toBe(true);
    expect(isCrampedLayout(264, 1)).toBe(true);
    expect(isCrampedLayout(344, 1.3)).toBe(true);
  });

  it('is false at a mild text scale, and at the threshold itself', () => {
    expect(isCrampedLayout(360, 1.15)).toBe(false);
    expect(isCrampedLayout(CRAMPED_EFFECTIVE_WIDTH, 1)).toBe(false);
  });

  it('never counts a text scale below 1 as making the layout wider', () => {
    expect(isCrampedLayout(280, 0.85)).toBe(true);
  });
});
