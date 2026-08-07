/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { Subject } from 'rxjs';

import { database } from '@/database';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';
import { useExerciseGoals } from '@/hooks/useExerciseGoals';
import { handleError } from '@/utils/handleError';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    desc: 'desc',
    eq: jest.fn((value: unknown) => ({ op: 'eq', value })),
    sortBy: jest.fn((field: string, direction: string) => ({ direction, field, kind: 'sortBy' })),
    take: jest.fn((count: number) => ({ count, kind: 'take' })),
    where: jest.fn((field: string, condition: unknown) => ({ condition, field })),
  },
}));

jest.mock('@/database', () => ({
  database: { get: jest.fn() },
}));

jest.mock('@/database/services/ExerciseGoalService', () => ({
  ExerciseGoalService: {
    getActiveGoals: jest.fn(),
    getGoalHistory: jest.fn(),
  },
}));

jest.mock('@/utils/handleError', () => ({
  handleError: jest.fn(),
}));

const { Q } = jest.requireMock('@nozbe/watermelondb');
const mockGetActiveGoals = ExerciseGoalService.getActiveGoals as jest.Mock;
const mockGetGoalHistory = ExerciseGoalService.getGoalHistory as jest.Mock;
const mockHandleError = handleError as jest.Mock;

/** Drives the sentinel observer the hook subscribes to. */
function mockGoalsTable() {
  const subject = new Subject<unknown[]>();
  const unsubscribe = jest.fn();
  const queryArgs: unknown[][] = [];

  (database.get as jest.Mock).mockReturnValue({
    query: jest.fn((...args: unknown[]) => {
      queryArgs.push(args);
      return {
        observe: () => ({
          subscribe: (observer: any) => {
            const sub = subject.subscribe(observer);
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
  });

  return { queryArgs, subject, unsubscribe };
}

const goals = (ids: string[]) => ids.map((id) => ({ id }));

describe('useExerciseGoals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveGoals.mockResolvedValue(goals(['a1', 'a2']));
    mockGetGoalHistory.mockResolvedValue([]);
  });

  it('loads every active goal in one shot and never paginates in active mode', async () => {
    mockGoalsTable();

    const { result } = renderHook(() => useExerciseGoals({ mode: 'active' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.goals).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
    expect(mockGetGoalHistory).not.toHaveBeenCalled();

    await act(async () => result.current.loadMore());
    expect(mockGetGoalHistory).not.toHaveBeenCalled();
  });

  // The "is there another page?" answer comes from a 1-row probe query rather than a count.
  it('probes for a further page when the first history page comes back full', async () => {
    mockGoalsTable();
    mockGetGoalHistory
      .mockResolvedValueOnce(goals(['h1', 'h2']))
      .mockResolvedValueOnce(goals(['h3']));

    const { result } = renderHook(() => useExerciseGoals({ initialLimit: 2, mode: 'history' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetGoalHistory).toHaveBeenNthCalledWith(1, 2, 0);
    expect(mockGetGoalHistory).toHaveBeenNthCalledWith(2, 1, 2);
    expect(result.current.hasMore).toBe(true);
  });

  it('skips the probe when the first history page is short of the limit', async () => {
    mockGoalsTable();
    mockGetGoalHistory.mockResolvedValue(goals(['h1']));

    const { result } = renderHook(() => useExerciseGoals({ initialLimit: 2, mode: 'history' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetGoalHistory).toHaveBeenCalledTimes(1);
    expect(result.current.hasMore).toBe(false);
  });

  it('appends the next batch from the advanced offset and stops when a short batch arrives', async () => {
    mockGoalsTable();
    mockGetGoalHistory
      .mockResolvedValueOnce(goals(['h1', 'h2']))
      .mockResolvedValueOnce(goals(['h3']))
      .mockResolvedValueOnce(goals(['h3']));

    const { result } = renderHook(() =>
      useExerciseGoals({ batchSize: 2, initialLimit: 2, mode: 'history' })
    );

    // Gate on `isLoading`, not on `hasMore`: `loadInitial` optimistically sets `hasMore` true
    // before it has fetched anything, so `offset` is still 0 at that point.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);

    await act(async () => result.current.loadMore());

    expect(mockGetGoalHistory).toHaveBeenLastCalledWith(2, 2);
    expect(result.current.goals.map((goal) => goal.id)).toEqual(['h1', 'h2', 'h3']);
    expect(result.current.hasMore).toBe(false);
  });

  // Deliberate contrast with `useNotes`, which grows a single observed window: here the sentinel
  // observer re-runs `loadInitial()`, so any edit to the table throws away the pages the user
  // pulled in with "Load more" and resets the list to the first page.
  it('resets pagination back to the first page when the goals table changes', async () => {
    const { subject } = mockGoalsTable();
    mockGetGoalHistory
      .mockResolvedValueOnce(goals(['h1', 'h2']))
      .mockResolvedValueOnce(goals(['h3']))
      .mockResolvedValueOnce(goals(['h3', 'h4']))
      .mockResolvedValue(goals(['h1', 'h2']));

    const { result } = renderHook(() =>
      useExerciseGoals({ batchSize: 2, initialLimit: 2, mode: 'history' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.loadMore());
    expect(result.current.goals).toHaveLength(4);

    await act(async () => {
      subject.next([]);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.goals).toHaveLength(2));
    expect(result.current.goals.map((goal) => goal.id)).toEqual(['h1', 'h2']);
  });

  it('observes a single sentinel row rather than the whole table', async () => {
    const { queryArgs } = mockGoalsTable();

    const { result } = renderHook(() => useExerciseGoals({ mode: 'active' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(database.get).toHaveBeenCalledWith('exercise_goals');
    expect(Q.take).toHaveBeenCalledWith(1);
    expect(Q.sortBy).toHaveBeenCalledWith('created_at', 'desc');
    expect(queryArgs[0]).toContainEqual({
      condition: { op: 'eq', value: null },
      field: 'deleted_at',
    });
  });

  it('neither queries nor subscribes while hidden, and clears the loading flag', async () => {
    mockGoalsTable();

    const { result } = renderHook(() => useExerciseGoals({ mode: 'history', visible: false }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetGoalHistory).not.toHaveBeenCalled();
    expect(database.get).not.toHaveBeenCalled();
  });

  it('empties the list and disables pagination when the read fails', async () => {
    mockGoalsTable();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('goal query failed');
    mockGetGoalHistory.mockRejectedValue(error);

    const { result } = renderHook(() => useExerciseGoals({ mode: 'history' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockHandleError).toHaveBeenCalledWith(error, 'useExerciseGoals.loadGoals');
    expect(result.current.goals).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    consoleError.mockRestore();
  });

  it('unsubscribes from the sentinel observer on unmount', async () => {
    const { unsubscribe } = mockGoalsTable();

    const { result, unmount } = renderHook(() => useExerciseGoals({ mode: 'active' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
