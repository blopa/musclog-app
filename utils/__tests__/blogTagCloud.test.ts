import { TAG_CLOUD_LEVELS, tagCloudLevel } from '../blogTagCloud';

describe('tagCloudLevel', () => {
  it('puts the least popular tag at the smallest step and the most popular at the biggest', () => {
    expect(tagCloudLevel(1, 1, 16)).toBe(0);
    expect(tagCloudLevel(16, 1, 16)).toBe(TAG_CLOUD_LEVELS - 1);
  });

  it('never ranks a more popular tag below a less popular one', () => {
    const levels = Array.from({ length: 16 }, (_, index) => tagCloudLevel(index + 1, 1, 16));
    expect(levels).toEqual([...levels].sort((left, right) => left - right));
  });

  it('spreads a skewed set of counts instead of leaving nearly everything smallest', () => {
    // Linear scaling would give a 3 out of 16 the smallest step; on a log scale it is bigger.
    expect(tagCloudLevel(3, 1, 16)).toBeGreaterThan(0);
  });

  it('gives every tag the middle step when they all have the same count', () => {
    expect(tagCloudLevel(4, 4, 4)).toBe(Math.floor((TAG_CLOUD_LEVELS - 1) / 2));
  });

  it('stays inside the available steps', () => {
    expect(tagCloudLevel(100, 1, 16)).toBe(TAG_CLOUD_LEVELS - 1);
    expect(tagCloudLevel(0.5, 1, 16)).toBe(0);
  });
});
