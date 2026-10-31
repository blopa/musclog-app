import { createThrottledEmitter } from '../throttledEmitter';

function fakeClock() {
  let now = 1_000;
  let timer: { at: number; callback: () => void } | null = null;
  return {
    clock: {
      now: () => now,
      setTimer: (callback: () => void, ms: number) => {
        timer = { at: now + ms, callback };
        return timer;
      },
      clearTimer: () => {
        timer = null;
      },
    },
    advance: (ms: number) => {
      now += ms;
      if (timer && timer.at <= now) {
        const { callback } = timer;
        timer = null;
        callback();
      }
    },
  };
}

describe('createThrottledEmitter', () => {
  it('emits the first value immediately and the latest one after the interval', () => {
    const { clock, advance } = fakeClock();
    const emit = jest.fn();
    const throttled = createThrottledEmitter<string>(emit, 100, clock);

    throttled.push('a');
    throttled.push('ab');
    throttled.push('abc');
    expect(emit.mock.calls).toEqual([['a']]);

    advance(100);
    expect(emit.mock.calls).toEqual([['a'], ['abc']]);
  });

  it('emits at most once per interval however many values arrive', () => {
    const { clock, advance } = fakeClock();
    const emit = jest.fn();
    const throttled = createThrottledEmitter<number>(emit, 50, clock);

    for (let i = 0; i < 20; i += 1) {
      throttled.push(i);
      advance(10);
    }

    advance(50);
    // 20 pushes over 200 ms at a 50 ms interval
    expect(emit.mock.calls.length).toBeLessThanOrEqual(6);
    expect(emit.mock.calls[emit.mock.calls.length - 1]).toEqual([19]);
  });

  it('flush emits the held value now and cancels the pending timer', () => {
    const { clock, advance } = fakeClock();
    const emit = jest.fn();
    const throttled = createThrottledEmitter<string>(emit, 100, clock);

    throttled.push('a');
    throttled.push('b');
    throttled.flush();
    expect(emit.mock.calls).toEqual([['a'], ['b']]);

    advance(500);
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('cancel drops the held value', () => {
    const { clock, advance } = fakeClock();
    const emit = jest.fn();
    const throttled = createThrottledEmitter<string>(emit, 100, clock);

    throttled.push('a');
    throttled.push('b');
    throttled.cancel();
    advance(500);
    throttled.flush();
    expect(emit.mock.calls).toEqual([['a']]);
  });
});
