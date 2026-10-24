import {
  clampWorkSeconds,
  WORK_TIMER_DEFAULT_SECONDS,
  WORK_TIMER_MAX_SECONDS,
  WORK_TIMER_MIN_SECONDS,
  workSecondsRemaining,
  workTimerBeat,
} from '../workTimer';

describe('clampWorkSeconds', () => {
  it('keeps a length within the range as whole seconds', () => {
    expect(clampWorkSeconds(45)).toBe(45);
    expect(clampWorkSeconds(44.6)).toBe(45);
  });

  it('clamps to the ends of the range', () => {
    expect(clampWorkSeconds(0)).toBe(WORK_TIMER_MIN_SECONDS);
    expect(clampWorkSeconds(10_000)).toBe(WORK_TIMER_MAX_SECONDS);
  });

  it('falls back to the default for a value that is not a number', () => {
    expect(clampWorkSeconds(Number.NaN)).toBe(WORK_TIMER_DEFAULT_SECONDS);
    expect(clampWorkSeconds(Number.POSITIVE_INFINITY)).toBe(WORK_TIMER_DEFAULT_SECONDS);
  });
});

describe('workSecondsRemaining', () => {
  it('rounds up, so the clock reads 0:01 until the instant it ends', () => {
    expect(workSecondsRemaining(10_000, 9_001)).toBe(1);
    expect(workSecondsRemaining(10_000, 10_000)).toBe(0);
  });

  it('is zero when stopped or already past', () => {
    expect(workSecondsRemaining(null, 5_000)).toBe(0);
    expect(workSecondsRemaining(10_000, 20_000)).toBe(0);
  });
});

describe('workTimerBeat', () => {
  it('ticks through the last three seconds and buzzes at zero', () => {
    expect(workTimerBeat(4, 3)).toBe('tick');
    expect(workTimerBeat(2, 1)).toBe('tick');
    expect(workTimerBeat(1, 0)).toBe('done');
  });

  it('is silent on the first reading and on a re-render of the same value', () => {
    expect(workTimerBeat(null, 3)).toBeNull();
    expect(workTimerBeat(3, 3)).toBeNull();
  });

  it('is silent outside the final stretch', () => {
    expect(workTimerBeat(30, 29)).toBeNull();
  });

  it('plays only where a skipped second lands', () => {
    expect(workTimerBeat(5, 2)).toBe('tick');
    expect(workTimerBeat(5, 0)).toBe('done');
  });
});
