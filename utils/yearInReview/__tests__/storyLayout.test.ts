import { fitFontSize, storyScale } from '@/utils/yearInReview/storyLayout';

describe('storyScale', () => {
  it('shrinks a poster on a small phone but keeps it readable', () => {
    expect(storyScale(300)).toBe(0.72);
    expect(storyScale(480)).toBe(0.8);
    expect(storyScale(600)).toBe(1);
  });

  it('stops growing on a tall screen', () => {
    expect(storyScale(2000)).toBe(1.2);
  });
});

describe('fitFontSize', () => {
  it('keeps a short figure at the full size', () => {
    expect(fitFontSize('7', 310, 132)).toBe(132);
  });

  it('shrinks a long figure so it stays on one line', () => {
    const size = fitFontSize('1,204,332', 310, 132);

    expect(size).toBeLessThan(132);
    expect(size * 9 * 0.62).toBeLessThanOrEqual(310);
  });

  it('does not divide by nothing', () => {
    expect(fitFontSize('', 310, 132)).toBe(132);
  });
});
