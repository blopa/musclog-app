/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { useHostedWaitCue } from '@/hooks/useHostedWaitCue';
import { HOSTED_SLOW_MS, whileHostedBackingOff } from '@/utils/premium/hostedWait';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useHostedWaitCue', () => {
  it('is quiet at first, says "working" after the slow threshold, and resets when the wait ends', () => {
    const { result, rerender } = renderHook(({ waiting }) => useHostedWaitCue(waiting), {
      initialProps: { waiting: true },
    });

    expect(result.current).toBeNull();
    act(() => {
      jest.advanceTimersByTime(HOSTED_SLOW_MS);
    });
    expect(result.current).toBe('working');

    rerender({ waiting: false });
    expect(result.current).toBeNull();
    rerender({ waiting: true });
    expect(result.current).toBeNull();
  });

  it('says "busy" immediately while a retry backs off, and shows nothing when not waiting', async () => {
    const { result, rerender } = renderHook(({ waiting }) => useHostedWaitCue(waiting), {
      initialProps: { waiting: true },
    });
    let release: () => void = () => undefined;
    let pending: Promise<void> = Promise.resolve();

    act(() => {
      pending = whileHostedBackingOff(() => new Promise<void>((resolve) => (release = resolve)));
    });
    expect(result.current).toBe('busy');

    rerender({ waiting: false });
    expect(result.current).toBeNull();

    await act(async () => {
      release();
      await pending;
    });
  });
});
