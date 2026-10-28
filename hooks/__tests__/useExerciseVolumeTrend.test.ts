/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { enUS } from 'date-fns/locale';

import { useExerciseVolumeTrend } from '@/hooks/useExerciseVolumeTrend';
import type { VolumeTrend } from '@/utils/volumeTrend';
import { calculateExerciseVolumeTrend } from '@/utils/workoutDetail';

jest.mock('@/utils/workoutDetail', () => ({ calculateExerciseVolumeTrend: jest.fn() }));

const calculate = calculateExerciseVolumeTrend as jest.Mock;

const trendOf = (percentage: number): VolumeTrend => ({ percentage, data: [], labels: [] });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => calculate.mockReset());

describe('useExerciseVolumeTrend', () => {
  it('is null without a selected exercise and calculates nothing', () => {
    const { result } = renderHook(() => useExerciseVolumeTrend('log-1', null, enUS));

    expect(result.current).toBeNull();
    expect(calculate).not.toHaveBeenCalled();
  });

  it('returns the trend once it has been calculated', async () => {
    calculate.mockResolvedValue(trendOf(5));

    const { result } = renderHook(() => useExerciseVolumeTrend('log-1', 'ex-1', enUS));

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual(trendOf(5)));
    expect(calculate).toHaveBeenCalledWith('log-1', 'ex-1', enUS);
  });

  it('never shows a slow response under a different exercise', async () => {
    const slow = deferred<VolumeTrend>();
    calculate.mockImplementation(async (_log: string, exerciseId: string) =>
      exerciseId === 'ex-a' ? slow.promise : trendOf(9)
    );

    const { result, rerender } = renderHook(
      ({ exerciseId }) => useExerciseVolumeTrend('log-1', exerciseId, enUS),
      { initialProps: { exerciseId: 'ex-a' as string | null } }
    );
    rerender({ exerciseId: 'ex-b' });
    await waitFor(() => expect(result.current).toEqual(trendOf(9)));

    slow.resolve(trendOf(1));
    await Promise.resolve();

    expect(result.current).toEqual(trendOf(9));
  });

  it('reads as null again once the selection is cleared', async () => {
    calculate.mockResolvedValue(trendOf(5));

    const { result, rerender } = renderHook(
      ({ exerciseId }) => useExerciseVolumeTrend('log-1', exerciseId, enUS),
      { initialProps: { exerciseId: 'ex-1' as string | null } }
    );
    await waitFor(() => expect(result.current).not.toBeNull());

    rerender({ exerciseId: null });

    expect(result.current).toBeNull();
  });
});
