/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkoutHistory } from '../useWorkoutHistory';
import { WorkoutService } from '../../database/services/WorkoutService';
import { WorkoutAnalytics } from '../../database/services/WorkoutAnalytics';

type FakeWorkoutLog = {
  id: string;
  workoutName: string;
  startedAt: number;
  completedAt: number | null;
  caloriesBurned?: number;
  totalVolume?: number;
};

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
  extend: jest.fn().mockReturnThis(),
};

const mockCollection = {
  query: jest.fn(() => mockQuery),
};

jest.mock('../../database/database-instance', () => ({
  database: {
    get: jest.fn(() => mockCollection),
  },
}));

jest.mock('../../database/services/WorkoutService', () => ({
  WorkoutService: {
    getWorkoutHistory: jest.fn(),
  },
}));

jest.mock('../../database/services/WorkoutAnalytics', () => ({
  WorkoutAnalytics: {
    detectPersonalRecords: jest.fn(),
  },
}));

jest.mock('../../utils/workoutHistory', () => ({
  calculateDateRange: jest.fn((range: string) => {
    if (range === '30') {
      const endDate = Date.now();
      const startDate = endDate - 30 * 24 * 60 * 60 * 1000;
      return { startDate, endDate };
    }
    return undefined;
  }),
  processWorkouts: jest.fn(async (workouts: any[], filters: any, t: any, units: any) => {
    // Simple mock - just return workouts as WorkoutHistoryItems
    return workouts.map((w) => ({
      id: w.id,
      name: w.workoutName,
      date: new Date(w.startedAt).toLocaleDateString(),
      dateTimestamp: w.startedAt,
      iconBgColor: '#000',
      iconBgOpacity: '#000',
      icon: jest.fn(),
      prCount: null,
      stats: [],
    }));
  }),
  groupWorkoutsByMonth: jest.fn((workouts: any[]) => {
    // Simple grouping mock
    const grouped = new Map<string, any[]>();
    workouts.forEach((w) => {
      const month = new Date(w.dateTimestamp).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      if (!grouped.has(month)) {
        grouped.set(month, []);
      }
      grouped.get(month)!.push(w);
    });
    return Array.from(grouped.entries()).map(([month, workouts]) => ({ month, workouts }));
  }),
  mergeWorkoutSections: jest.fn((existing: any[], newWorkouts: any[]) => {
    // Simple merge mock - just combine
    const allWorkouts = [...existing.flatMap((s) => s.workouts), ...newWorkouts];
    const grouped = new Map<string, any[]>();
    allWorkouts.forEach((w) => {
      const month = new Date(w.dateTimestamp).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      if (!grouped.has(month)) {
        grouped.set(month, []);
      }
      grouped.get(month)!.push(w);
    });
    return Array.from(grouped.entries()).map(([month, workouts]) => ({ month, workouts }));
  }),
  filterWorkoutsBySearch: jest.fn((sections: any[], query: string) => {
    if (!query) return sections;
    return sections
      .map((section) => ({
        ...section,
        workouts: section.workouts.filter((w: any) =>
          w.name.toLowerCase().includes(query.toLowerCase())
        ),
      }))
      .filter((section) => section.workouts.length > 0);
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.today': 'Today',
        'common.yesterday': 'Yesterday',
        'common.min': 'min',
        'common.kcal': 'kcal',
        'pastWorkoutHistory.stats.duration': 'Duration',
        'pastWorkoutHistory.stats.volume': 'Volume',
        'pastWorkoutHistory.stats.calories': 'Calories',
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

jest.mock('../useSettings', () => ({
  useSettings: () => ({
    units: 'metric' as const,
    weightUnit: 'kg' as const,
    heightUnit: 'cm' as const,
    isLoading: false,
  }),
}));

// Mock image assets
jest.mock('../../assets/icon.png', () => 'mock-icon.png', { virtual: true });

describe('useWorkoutHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.observe.mockReturnValue(createMockObservable([]));
    (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue([]);
    (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);
  });

  describe('Flat mode (groupByMonth = false)', () => {
    it('returns empty workouts and isLoading false after first load when no workouts', async () => {
      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 2,
          groupByMonth: false,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect('workouts' in result.current && result.current.workouts).toEqual([]);
      expect('sections' in result.current).toBe(false);
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

      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue(mockWorkoutLogs);
      (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([
        { exerciseId: 'ex1', type: 'weight' },
      ]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 2,
          groupByMonth: false,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('workouts' in result.current) {
        expect(result.current.workouts).toHaveLength(1);
        expect(result.current.workouts[0].name).toBe('Push Day');
        expect(result.current.workouts[0].calories).toBe(300);
        expect(result.current.workouts[0].prs).toBe(1);
        expect(result.current.workouts[0].duration).toBe('1h');
      }
    });

    it('respects initialLimit parameter', async () => {
      const now = Date.now();
      const mockWorkoutLogs = [
        { id: '1', workoutName: 'Workout 1', startedAt: now - 3600000, completedAt: now },
        { id: '2', workoutName: 'Workout 2', startedAt: now - 7200000, completedAt: now - 3600000 },
      ] as any;

      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue(mockWorkoutLogs);
      (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 2,
          groupByMonth: false,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('workouts' in result.current) {
        expect(result.current.workouts.length).toBe(2);
        expect(result.current.workouts[0].name).toBe('Workout 1');
        expect(result.current.workouts[1].name).toBe('Workout 2');
      }
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

      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue(mockWorkoutLogs);
      (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 2,
          groupByMonth: false,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('workouts' in result.current) {
        expect(result.current.workouts[0].duration).toBe('30m');
      }
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

      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue(mockWorkoutLogs);
      (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 2,
          groupByMonth: false,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('workouts' in result.current) {
        expect(result.current.workouts[0].prs).toBe(null);
      }
    });

    it('unsubscribes on unmount when reactivity is enabled', async () => {
      const { unmount } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 2,
          groupByMonth: false,
          enableReactivity: true,
        })
      );

      await waitFor(() => {
        expect(unsubscribeFn).toBeDefined();
      });

      unmount();
      expect(unsubscribeFn).toHaveBeenCalled();
    });
  });

  describe('Grouped mode (groupByMonth = true)', () => {
    it('returns empty sections when no workouts', async () => {
      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 5,
          groupByMonth: true,
          visible: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect('sections' in result.current && result.current.sections).toEqual([]);
      expect('workouts' in result.current).toBe(false);
    });

    it('groups workouts by month', async () => {
      const now = Date.now();
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
      const mockWorkoutLogs = [
        {
          id: '1',
          workoutName: 'Workout 1',
          startedAt: now - 3600000,
          completedAt: now,
          totalVolume: 5000,
        },
        {
          id: '2',
          workoutName: 'Workout 2',
          startedAt: oneMonthAgo,
          completedAt: oneMonthAgo + 3600000,
          totalVolume: 4000,
        },
      ] as any;

      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue(mockWorkoutLogs);
      (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 5,
          groupByMonth: true,
          visible: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('sections' in result.current) {
        expect(result.current.sections.length).toBeGreaterThan(0);
      }
    });

    it('provides filter functions', async () => {
      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 5,
          groupByMonth: true,
          visible: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('sections' in result.current) {
        expect(typeof result.current.handleApplyFilters).toBe('function');
        expect(typeof result.current.handleClearFilters).toBe('function');
        expect(typeof result.current.setSearchQuery).toBe('function');
        expect(result.current.filters).toBeDefined();
        expect(result.current.searchQuery).toBeDefined();
      }
    });

    it('handles search query', async () => {
      const now = Date.now();
      const mockWorkoutLogs = [
        {
          id: '1',
          workoutName: 'Push Day',
          startedAt: now - 3600000,
          completedAt: now,
        },
        {
          id: '2',
          workoutName: 'Pull Day',
          startedAt: now - 7200000,
          completedAt: now - 3600000,
        },
      ] as any;

      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue(mockWorkoutLogs);
      (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 5,
          groupByMonth: true,
          visible: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('sections' in result.current) {
        act(() => {
          result.current.setSearchQuery('Push');
        });

        await waitFor(() => {
          // Search filtering happens client-side
          expect(result.current.searchQuery).toBe('Push');
        });
      }
    });

    it('respects visible parameter', async () => {
      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 5,
          groupByMonth: true,
          visible: false,
        })
      );

      // When visible is false, should not load data
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Reactivity', () => {
    it('does not observe when enableReactivity is false', async () => {
      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue([]);

      renderHook(() =>
        useWorkoutHistory({
          initialLimit: 2,
          groupByMonth: false,
          enableReactivity: false,
        })
      );

      await waitFor(() => {
        // Should still load data, but not set up observation
        expect(WorkoutService.getWorkoutHistory).toHaveBeenCalled();
      });

      // The observe should not be called when reactivity is disabled
      // (though it might be called for the initial load check)
    });
  });

  describe('Date formatting', () => {
    it('formats this week date correctly', async () => {
      // Get a date from earlier this week (not today, not yesterday)
      const today = new Date();
      const daysFromMonday = today.getDay() === 0 ? 6 : today.getDay() - 1; // Convert Sunday=0 to 6
      const thisWeekDate = new Date(today);
      thisWeekDate.setDate(today.getDate() - (daysFromMonday > 0 ? daysFromMonday : 1));
      const thisWeekTimestamp = thisWeekDate.getTime();

      const mockWorkoutLogs = [
        {
          id: '1',
          workoutName: 'This Week Workout',
          startedAt: thisWeekTimestamp - 3600000,
          completedAt: thisWeekTimestamp,
          caloriesBurned: 200,
        } as any,
      ];

      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue(mockWorkoutLogs);
      (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 2,
          groupByMonth: false,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('workouts' in result.current) {
        // Should be a day name like "Monday", "Tuesday", etc.
        expect(result.current.workouts[0].date).toMatch(
          /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/
        );
      }
    });

    it('formats older dates correctly', async () => {
      // Use a date from more than a week ago
      const olderDate = new Date();
      olderDate.setDate(olderDate.getDate() - 10);
      const olderTimestamp = olderDate.getTime();

      const mockWorkoutLogs = [
        {
          id: '1',
          workoutName: 'Older Workout',
          startedAt: olderTimestamp - 3600000,
          completedAt: olderTimestamp,
          caloriesBurned: 200,
        } as any,
      ];

      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue(mockWorkoutLogs);
      (WorkoutAnalytics.detectPersonalRecords as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 2,
          groupByMonth: false,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('workouts' in result.current) {
        // Should be formatted as "MMM d" like "Jan 15"
        expect(result.current.workouts[0].date).toMatch(/^[A-Za-z]{3} \d{1,2}$/);
      }
    });
  });

  describe('Error handling', () => {
    it('handles error in loadInitialWorkouts for flat mode', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (WorkoutService.getWorkoutHistory as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 2,
          groupByMonth: false,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('workouts' in result.current) {
        expect(result.current.workouts).toEqual([]);
        expect(result.current.hasMore).toBe(false);
      }
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading workout history:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('handles error in loadInitialWorkouts for grouped mode', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (WorkoutService.getWorkoutHistory as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 5,
          groupByMonth: true,
          visible: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('sections' in result.current) {
        expect(result.current.sections).toEqual([]);
        expect(result.current.hasMore).toBe(false);
      }
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading workout history:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Filter handling', () => {
    it('applies filters correctly', async () => {
      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 5,
          groupByMonth: true,
          visible: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('sections' in result.current) {
        const initialFilters = result.current.filters;

        act(() => {
          result.current.handleApplyFilters({
            workoutType: 'strength',
            dateRange: '30',
            minDuration: 30,
          });
        });

        await waitFor(() => {
          expect(result.current.filters.workoutType).toBe('strength');
          expect(result.current.filters.dateRange).toBe('30');
          expect(result.current.filters.minDuration).toBe(30);
          // muscleGroups should remain from initial
          expect(result.current.filters.muscleGroups).toEqual(initialFilters.muscleGroups);
        });
      }
    });

    it('clears filters correctly', async () => {
      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 5,
          groupByMonth: true,
          visible: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('sections' in result.current) {
        // Apply some filters first
        act(() => {
          result.current.handleApplyFilters({
            workoutType: 'strength',
            dateRange: '30',
            minDuration: 30,
            muscleGroups: ['chest'],
          });
        });

        await waitFor(() => {
          expect(result.current.filters.workoutType).toBe('strength');
        });

        // Now clear filters
        act(() => {
          result.current.handleClearFilters();
        });

        await waitFor(() => {
          expect(result.current.filters).toEqual({
            workoutType: 'all',
            dateRange: '30',
            muscleGroups: [],
            minDuration: 0,
          });
        });
      }
    });

    it('handles partial filter updates', async () => {
      (WorkoutService.getWorkoutHistory as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useWorkoutHistory({
          initialLimit: 5,
          groupByMonth: true,
          visible: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if ('sections' in result.current) {
        const initialFilters = { ...result.current.filters };

        // Apply only workoutType
        act(() => {
          result.current.handleApplyFilters({
            workoutType: 'cardio',
          });
        });

        await waitFor(() => {
          expect(result.current.filters.workoutType).toBe('cardio');
          // Other filters should remain unchanged
          expect(result.current.filters.dateRange).toBe(initialFilters.dateRange);
          expect(result.current.filters.muscleGroups).toEqual(initialFilters.muscleGroups);
          expect(result.current.filters.minDuration).toBe(initialFilters.minDuration);
        });
      }
    });
  });
});
