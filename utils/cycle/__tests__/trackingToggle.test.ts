import { resolveTrackingToggle } from '../trackingToggle';

describe('resolveTrackingToggle', () => {
  it.each([
    [undefined, false, false, 'none'],
    [true, true, false, 'none'],
    [false, false, true, 'none'],
    [false, true, false, 'pause'],
    [true, false, true, 'resume'],
    [true, false, false, 'setup'],
  ] as const)(
    'requested=%s active=%s paused=%s -> %s',
    (requested, isActive, hasPausedCycle, expected) => {
      expect(resolveTrackingToggle({ requested, isActive, hasPausedCycle })).toBe(expected);
    }
  );
});
