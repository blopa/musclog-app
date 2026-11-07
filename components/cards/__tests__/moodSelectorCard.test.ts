// The card draws a slider and a gradient card; only its pure rule is under test here.
jest.mock('@/components/theme/Slider', () => ({ Slider: () => null }));
jest.mock('@/components/cards/GenericCard', () => ({ GenericCard: () => null }));

import { showMoodCaptions } from '@/components/cards/MoodSelectorCard';

describe('showMoodCaptions', () => {
  it('keeps the captions on a phone at the default text size', () => {
    expect(showMoodCaptions(360, 1)).toBe(true);
    expect(showMoodCaptions(344, 1)).toBe(true);
  });

  it('drops them where five translated words no longer fit, however large text arrives', () => {
    expect(showMoodCaptions(360, 1.3)).toBe(false);
    // Web and the layout audit narrow the viewport instead of raising fontScale.
    expect(showMoodCaptions(264, 1)).toBe(false);
  });
});
