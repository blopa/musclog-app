/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useMacroStreak } from '@/hooks/useMacroStreak';
import { getMacroStreak } from '@/utils/macroStreak';

// The once-per-local-day recompute and the never-shrinking best streak live in
// `utils/macroStreak` (covered by `utils/__tests__/macroStreak.test.ts`). These tests pin the
// hook layer: when it reads, when it re-reads, and what it reports while a read is in flight.
jest.mock('@/utils/macroStreak', () => ({
  getMacroStreak: jest.fn(),
}));

const mockGetMacroStreak = getMacroStreak as jest.Mock;

const DAY_1 = new Date(2026, 5, 15, 12, 0);
const DAY_2 = new Date(2026, 5, 16, 12, 0);

describe('useMacroStreak', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMacroStreak.mockResolvedValue({ bestStreak: 12, currentStreak: 4 });
  });

  it('reports zeroed loading state until the cached streak resolves', async () => {
    const { result } = renderHook(() => useMacroStreak());

    expect(result.current).toEqual({ bestStreak: 0, currentStreak: 0, isLoading: true });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentStreak).toBe(4);
    expect(result.current.bestStreak).toBe(12);
    expect(mockGetMacroStreak).toHaveBeenCalledWith(undefined);
  });

  it('reads the streak for the supplied day', async () => {
    const { result } = renderHook(() => useMacroStreak({ date: DAY_1 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetMacroStreak).toHaveBeenCalledTimes(1);
    expect((mockGetMacroStreak.mock.calls[0][0] as Date).getTime()).toBe(DAY_1.getTime());
  });

  // The effect keys off the timestamp, not the Date identity, so the diary re-rendering with a
  // fresh `new Date(sameDay)` must not fire another read.
  it('does not re-read when re-rendered with an equal but distinct Date', async () => {
    const { rerender, result } = renderHook(
      ({ date }: { date: Date }) => useMacroStreak({ date }),
      {
        initialProps: { date: DAY_1 },
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      rerender({ date: new Date(DAY_1.getTime()) });
    });

    expect(mockGetMacroStreak).toHaveBeenCalledTimes(1);
  });

  it('re-reads and returns to loading when the day changes', async () => {
    const { rerender, result } = renderHook(
      ({ date }: { date: Date }) => useMacroStreak({ date }),
      {
        initialProps: { date: DAY_1 },
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolveSecond: (value: { bestStreak: number; currentStreak: number }) => void = () => {};
    mockGetMacroStreak.mockReturnValue(
      new Promise<{ bestStreak: number; currentStreak: number }>((resolve) => {
        resolveSecond = resolve;
      })
    );

    act(() => rerender({ date: DAY_2 }));
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSecond({ bestStreak: 12, currentStreak: 5 });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.currentStreak).toBe(5);
    expect(mockGetMacroStreak).toHaveBeenCalledTimes(2);
  });

  it('skips the read entirely while the card is not visible', async () => {
    const { rerender, result } = renderHook(
      ({ visible }: { visible: boolean }) => useMacroStreak({ visible }),
      { initialProps: { visible: false } }
    );

    expect(mockGetMacroStreak).not.toHaveBeenCalled();
    // Nothing is pending, so the card must not render a spinner forever.
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      rerender({ visible: true });
    });

    await waitFor(() => expect(result.current.currentStreak).toBe(4));
    expect(mockGetMacroStreak).toHaveBeenCalledTimes(1);
  });

  it('keeps the last known streak and stops loading when the read fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender, result } = renderHook(
      ({ date }: { date: Date }) => useMacroStreak({ date }),
      {
        initialProps: { date: DAY_1 },
      }
    );

    await waitFor(() => expect(result.current.currentStreak).toBe(4));

    mockGetMacroStreak.mockRejectedValue(new Error('storage unavailable'));
    await act(async () => {
      rerender({ date: DAY_2 });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentStreak).toBe(4);
    expect(result.current.bestStreak).toBe(12);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
