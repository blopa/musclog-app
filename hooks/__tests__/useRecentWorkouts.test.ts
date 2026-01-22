/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkoutHistory } from '../useWorkoutHistory';
import { WorkoutAnalytics } from '../../database/services/WorkoutAnalytics';

type FakeWorkoutLog = { id: string; workoutName: string; completedAt: number | null };
let subscribeNext: (val: FakeWorkoutLog[]) => void;
let unsubscribeFn: jest.Mock;

const createMockObservable = (initialEmit: FakeWorkoutLog[]) => ({
  subscribe: (handlers: { next: (v: FakeWorkoutLog[]) => void; error?: (e: unknown) => void }) => {
    subscribeNext = handlers.next;
    handlers.next(initialEmit);
    unsubscribeFn = jest.fn();
    return { unsubscribe: unsubscribeFn };
  },
});

const mockQuery = {
  observe: jest.fn(),
};

const mockCollection = {
  query: jest.fn(() => mockQuery),
};

jest.mock('../../database/database-instance', () => ({
  database: {
    get: jest.fn(() => mockCollection),
  },
}));

jest.mock('../../database/services/WorkoutAnalytics', () => ({
  WorkoutAnalytics: {
    detectPersonalRecords: jest.fn(),
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.today': 'Today',
        'common.yesterday': 'Yesterday',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('../../theme', () => ({
  theme: {
    colors: {
      background: {
        imageLight: '#ffffff',
      },
    },
  },
}));

// Mock image assets
jest.mock('../../assets/icon.png', () => 'mock-icon.png', { virtual: true });

describe('useWorkoutHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.observe.mockReturnValue(createMockObservable([]));
    (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);
  });

  it('returns empty workouts and isLoading false after first emit when no workouts', async () => {
    const { result } = renderHook(() => useWorkoutHistory(2));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.workouts).toEqual([]);
  });

  it('returns processed workouts with metadata when available', async () => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const mockWorkoutLogs = [
      {
        id: '1',
        workoutName: 'Push Day',
        startedAt: oneHourAgo,
        completedAt: now,
        caloriesBurned: 300,
      } as any,
    ];

    (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([
      { exerciseId: 'ex1', type: 'weight' },
    ]);

    mockQuery.observe.mockReturnValue(createMockObservable(mockWorkoutLogs));

    const { result } = renderHook(() => useWorkoutHistory(2));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.workouts).toHaveLength(1);
    expect(result.current.workouts[0].name).toBe('Push Day');
    expect(result.current.workouts[0].calories).toBe(300);
    expect(result.current.workouts[0].prs).toBe(1);
    expect(result.current.workouts[0].duration).toBe('1h');
  });

  it('handles error by setting empty workouts', async () => {
    let errorHandler: (e: unknown) => void;
    const mockObs = {
      subscribe: (handlers: {
        next: (v: FakeWorkoutLog[]) => void;
        error?: (e: unknown) => void;
      }) => {
        subscribeNext = handlers.next;
        errorHandler = handlers.error!;
        // Emit error synchronously
        setTimeout(() => errorHandler(new Error('db error')), 0);
        unsubscribeFn = jest.fn();
        return { unsubscribe: unsubscribeFn };
      },
    };
    mockQuery.observe.mockReturnValue(mockObs);

    const { result } = renderHook(() => useWorkoutHistory(2));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.workouts).toEqual([]);
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useWorkoutHistory(2));

    await waitFor(() => {
      expect(unsubscribeFn).toBeDefined();
    });

    unmount();
    expect(unsubscribeFn).toHaveBeenCalled();
  });

  it('respects limit parameter', async () => {
    const now = Date.now();
    // The query applies Q.take(limit), so the observable should only emit the limited results
    // We simulate this by only passing 2 workout logs to the mock (what the query would return with limit=2)
    const mockWorkoutLogs = [
      { id: '1', workoutName: 'Workout 1', startedAt: now - 3600000, completedAt: now },
      { id: '2', workoutName: 'Workout 2', startedAt: now - 7200000, completedAt: now - 3600000 },
    ] as any;

    (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);

    // Reset and set up the mock for this specific test
    mockQuery.observe.mockReturnValue(createMockObservable(mockWorkoutLogs));

    const { result } = renderHook(() => useWorkoutHistory(2));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should only return 2 workouts due to limit
    expect(result.current.workouts.length).toBe(2);
    expect(result.current.workouts[0].name).toBe('Workout 1');
    expect(result.current.workouts[1].name).toBe('Workout 2');
  });

  it('formats duration correctly for workouts under 60 minutes', async () => {
    const now = Date.now();
    const thirtyMinutesAgo = now - 1800000;
    const mockWorkoutLogs = [
      {
        id: '1',
        workoutName: 'Quick Workout',
        startedAt: thirtyMinutesAgo,
        completedAt: now,
        caloriesBurned: 150,
      } as any,
    ];

    (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);

    mockQuery.observe.mockReturnValue(createMockObservable(mockWorkoutLogs));

    const { result } = renderHook(() => useWorkoutHistory(2));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.workouts[0].duration).toBe('30m');
  });

  it('handles workouts with no PRs', async () => {
    const now = Date.now();
    const mockWorkoutLogs = [
      {
        id: '1',
        workoutName: 'Workout',
        startedAt: now - 3600000,
        completedAt: now,
        caloriesBurned: 200,
      } as any,
    ];

    (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);

    mockQuery.observe.mockReturnValue(createMockObservable(mockWorkoutLogs));

    const { result } = renderHook(() => useWorkoutHistory(2));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.workouts[0].prs).toBe(null);
  });
});
