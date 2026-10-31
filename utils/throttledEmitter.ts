export type ThrottledEmitter<T> = {
  /** Emits now when the interval has passed, otherwise keeps the latest value for the trailing emit. */
  push: (value: T) => void;
  /** Emits the held value immediately, if any. */
  flush: () => void;
  /** Drops the held value without emitting it. */
  cancel: () => void;
};

type Clock = {
  now: () => number;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

const SYSTEM_CLOCK: Clock = {
  now: () => Date.now(),
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Rate-limits a stream of values to one emit per `intervalMs`, always ending on the latest value.
 * Used so token-by-token text doesn't re-render a chat list (or hit storage) per token.
 */
export function createThrottledEmitter<T>(
  emit: (value: T) => void,
  intervalMs: number,
  clock: Clock = SYSTEM_CLOCK
): ThrottledEmitter<T> {
  let lastEmitAt = Number.NEGATIVE_INFINITY;
  let held: { value: T } | null = null;
  let timer: unknown = null;

  const emitHeld = () => {
    if (timer !== null) {
      clock.clearTimer(timer);
      timer = null;
    }

    if (!held) {
      return;
    }

    const { value } = held;
    held = null;
    lastEmitAt = clock.now();
    emit(value);
  };

  return {
    push: (value) => {
      held = { value };
      const wait = lastEmitAt + intervalMs - clock.now();
      if (wait <= 0) {
        emitHeld();
        return;
      }

      if (timer === null) {
        timer = clock.setTimer(emitHeld, wait);
      }
    },
    flush: emitHeld,
    cancel: () => {
      held = null;
      if (timer !== null) {
        clock.clearTimer(timer);
        timer = null;
      }
    },
  };
}
