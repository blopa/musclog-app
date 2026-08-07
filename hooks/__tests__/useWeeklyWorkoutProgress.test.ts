/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { Subject } from 'rxjs';

import { database } from '@/database';
import { ExerciseGoalService, WorkoutService } from '@/database/services';
import { useWeeklyWorkoutProgress } from '@/hooks/useWeeklyWorkoutProgress';
import { handleError } from '@/utils/handleError';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    eq: jest.fn((value: unknown) => ({ op: 'eq', value })),
    notEq: jest.fn((value: unknown) => ({ op: 'notEq', value })),
    where: jest.fn((field: string, condition: unknown) => ({ condition, field })),
  },
}));

jest.mock('@/database', () => ({
  database: { get: jest.fn() },
}));

jest.mock('@/database/services', () => ({
  ExerciseGoalService: { getActiveConsistencyGoal: jest.fn() },
  WorkoutService: { getRollingWeeklyCompletedWorkoutCount: jest.fn() },
}));

jest.mock('@/utils/handleError', () => ({
  handleError: jest.fn(),
}));

const { Q } = jest.requireMock('@nozbe/watermelondb');
const mockGetCount = WorkoutService.getRollingWeeklyCompletedWorkoutCount as jest.Mock;
const mockGetGoal = ExerciseGoalService.getActiveConsistencyGoal as jest.Mock;
const mockHandleError = handleError as jest.Mock;

/** One rxjs Subject per observed table, so each observer can be driven independently. */
function mockTables() {
  const subjects: Record<string, Subject<unknown[]>> = {
    exercise_goals: new Subject(),
    workout_logs: new Subject(),
  };
  const unsubscribe = jest.fn();
  const queryArgs: Record<string, unknown[]> = {};

  (database.get as jest.Mock).mockImplementation((table: string) => ({
    query: jest.fn((...args: unknown[]) => {
      queryArgs[table] = args;
      return {
        observe: () => ({
          subscribe: (observer: any) => {
            const sub = subjects[table].subscribe(observer);
            return {
              unsubscribe: () => {
                unsubscribe();
                sub.unsubscribe();
              },
            };
          },
        }),
      };
    }),
  }));

  return { queryArgs, subjects, unsubscribe };
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const DATE = new Date(2026, 5, 15, 12, 0);

describe('useWeeklyWorkoutProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetCount.mockResolvedValue(3);
    mockGetGoal.mockResolvedValue({ targetSessionsPerWeek: 4 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads the rolling weekly count and the active consistency goal for the given day', async () => {
    mockTables();

    const { result } = renderHook(() => useWeeklyWorkoutProgress({ date: DATE }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.workoutsThisWeek).toBe(3);
    expect(result.current.weeklyGoal).toBe(4);
    expect((mockGetCount.mock.calls[0][0] as Date).getTime()).toBe(DATE.getTime());
  });

  // No consistency goal means the card renders no goal dots at all.
  it('reports a null weekly goal when no consistency goal is active', async () => {
    mockTables();
    mockGetGoal.mockResolvedValue(null);

    const { result } = renderHook(() => useWeeklyWorkoutProgress({ date: DATE }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.weeklyGoal).toBeNull();
  });

  // Only *completed*, non-deleted logs count towards the week — an abandoned session must not
  // inflate the streak card.
  it('watches only completed, non-deleted workout logs', () => {
    const { queryArgs } = mockTables();

    renderHook(() => useWeeklyWorkoutProgress({ date: DATE }));

    expect(queryArgs.workout_logs).toEqual([
      { condition: { op: 'notEq', value: null }, field: 'completed_at' },
      { condition: { op: 'eq', value: null }, field: 'deleted_at' },
    ]);
    expect(Q.where).toHaveBeenCalledWith('goal_type', 'consistency');
  });

  it('collapses a burst of table emissions into a single reload after the debounce window', async () => {
    const { subjects } = mockTables();

    const { result } = renderHook(() => useWeeklyWorkoutProgress({ date: DATE }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetCount).toHaveBeenCalledTimes(1);

    act(() => {
      subjects.workout_logs.next([]);
      subjects.workout_logs.next([]);
      subjects.exercise_goals.next([]);
    });

    act(() => jest.advanceTimersByTime(249));
    expect(mockGetCount).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(1));
    await flush();
    expect(mockGetCount).toHaveBeenCalledTimes(2);
  });

  it('neither queries nor subscribes while the card is hidden', async () => {
    mockTables();

    renderHook(() => useWeeklyWorkoutProgress({ date: DATE, visible: false }));

    act(() => jest.advanceTimersByTime(500));
    await flush();

    expect(mockGetCount).not.toHaveBeenCalled();
    expect(database.get).not.toHaveBeenCalled();
  });

  it('stops loading and reports the failure when the read throws', async () => {
    mockTables();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('query failed');
    mockGetCount.mockRejectedValue(error);

    const { result } = renderHook(() => useWeeklyWorkoutProgress({ date: DATE }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockHandleError).toHaveBeenCalledWith(error, 'useWeeklyWorkoutProgress.loadProgress');
    expect(result.current.workoutsThisWeek).toBe(0);
    consoleError.mockRestore();
  });

  it('tears down both observers on unmount', async () => {
    const { unsubscribe } = mockTables();

    const { result, unmount } = renderHook(() => useWeeklyWorkoutProgress({ date: DATE }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });
});
