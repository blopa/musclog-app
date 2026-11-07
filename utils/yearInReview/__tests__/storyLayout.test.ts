import { storyScale } from '@/utils/yearInReview/storyLayout';

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
