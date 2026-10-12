import {
  clampRestSeconds,
  HAPTIC_TICK_SECONDS,
  hapticBeat,
  resolveRestSeconds,
  restPhase,
} from '../restTimer';

describe('resolveRestSeconds', () => {
  it("uses the set's own rest when it names one", () => {
    expect(resolveRestSeconds(90, 60)).toBe(90);
    expect(resolveRestSeconds(30, 120)).toBe(30);
  });

  it('falls back to the default for 0, null, undefined and negative values', () => {
    expect(resolveRestSeconds(0, 75)).toBe(75);
    expect(resolveRestSeconds(null, 75)).toBe(75);
    expect(resolveRestSeconds(undefined, 75)).toBe(75);
    expect(resolveRestSeconds(-10, 75)).toBe(75);
  });

  it('defaults to 60 seconds when nothing else is configured', () => {
    expect(resolveRestSeconds(undefined)).toBe(60);
  });
});

describe('clampRestSeconds', () => {
  it('keeps a value in range, rounded to whole seconds', () => {
    expect(clampRestSeconds(90)).toBe(90);
    expect(clampRestSeconds(44.6)).toBe(45);
  });

  it('pins out-of-range values to the limits', () => {
    expect(clampRestSeconds(0)).toBe(15);
    expect(clampRestSeconds(-50)).toBe(15);
    expect(clampRestSeconds(9999)).toBe(600);
  });

  it('falls back to the default for anything that is not a number', () => {
    expect(clampRestSeconds(Number.NaN)).toBe(60);
    expect(clampRestSeconds(Infinity)).toBe(60);
  });
});

describe('restPhase', () => {
  it('rests until the last ten seconds, then gets ready, then is done', () => {
    expect(restPhase(60, 90)).toBe('resting');
    expect(restPhase(11, 90)).toBe('resting');
    expect(restPhase(10, 90)).toBe('getReady');
    expect(restPhase(1, 90)).toBe('getReady');
    expect(restPhase(0, 90)).toBe('done');
  });

  it('has no get-ready state for a rest that is no longer than the window itself', () => {
    expect(restPhase(8, 10)).toBe('resting');
    expect(restPhase(5, 8)).toBe('resting');
    expect(restPhase(0, 10)).toBe('done');
  });

  it('treats a negative remaining time as done', () => {
    expect(restPhase(-3, 60)).toBe('done');
  });
});

describe('hapticBeat', () => {
  it('ticks on the way down to the last seconds and buzzes at zero', () => {
    expect(hapticBeat(4, 3)).toBe('tick');
    expect(hapticBeat(3, 2)).toBe('tick');
    expect(hapticBeat(2, 1)).toBe('tick');
    expect(hapticBeat(1, 0)).toBe('done');
  });

  it('is silent for every other second', () => {
    for (const remaining of [60, 30, 10, 5, 4]) {
      expect(hapticBeat(remaining + 1, remaining)).toBeNull();
    }
  });

  it('never fires twice for the same value, so an unrelated re-render stays quiet', () => {
    expect(hapticBeat(2, 2)).toBeNull();
    expect(hapticBeat(0, 0)).toBeNull();
  });

  it('stays quiet on the first reading, which is a starting point and not a transition', () => {
    expect(hapticBeat(null, 3)).toBeNull();
    expect(hapticBeat(null, 0)).toBeNull();
  });

  it('fires for where a skipped-ahead jump lands, not for the beats it skipped', () => {
    // Backgrounded at 8 s, resumed with 1 s left: one tick for 1, none for the skipped 3 and 2.
    expect(hapticBeat(8, 1)).toBe('tick');
    expect(hapticBeat(8, 0)).toBe('done');
    expect(hapticBeat(8, 5)).toBeNull();
  });

  it('keeps tick seconds descending and ending just before zero', () => {
    expect([...HAPTIC_TICK_SECONDS]).toEqual([3, 2, 1]);
  });
});
