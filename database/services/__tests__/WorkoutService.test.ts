import { database } from '@/database/database-instance';
import { WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import { WorkoutService } from '@/database/services/WorkoutService';
import { getActiveWorkoutLogId } from '@/utils/activeWorkoutStorage';

import {
  createMockExercise,
  createMockSchedule,
  createMockWorkoutLog,
  createMockWorkoutLogExercise,
  createMockWorkoutLogSet,
  createMockWorkoutTemplate,
} from './helpers';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => value),
    notEq: jest.fn((value: any) => value),
    gte: jest.fn((value: any) => value),
    lte: jest.fn((value: any) => value),
    oneOf: jest.fn((values: any[]) => values),
    sortBy: jest.fn((field: string, direction: any) => ({ field, direction })),
    take: jest.fn((count: number) => count),
    skip: jest.fn((count: number) => count),
    desc: 'desc' as const,
    asc: 'asc' as const,
  },
}));

// Modules further down the graph still reach the database through the `database/index`
// barrel; loading it for real would evaluate every WatermelonDB model against the `Q`-only
// mock above (`class X extends Model` with `Model` undefined), so point it at the same
// mocked instance.
jest.mock('../../index', () => require('../../database-instance'));

jest.mock('../../database-instance', () => {
  const mockQuery = {
    fetch: jest.fn().mockResolvedValue([]),
    extend: jest.fn().mockReturnThis(),
  };

  const mockCollection = {
    query: jest.fn().mockReturnValue(mockQuery),
    find: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    prepareCreate: jest.fn().mockReturnValue({}),
    fetch: jest.fn().mockResolvedValue([]),
  };

  const mockWriter = {} as any;

  return {
    database: {
      get: jest.fn().mockReturnValue(mockCollection),
      write: jest.fn((callback) => Promise.resolve(callback(mockWriter))),
      batch: jest.fn().mockResolvedValue(undefined),
      collections: {
        get: jest.fn().mockReturnValue(mockCollection),
      },
    },
  };
});

jest.mock('../WorkoutAnalytics', () => ({
  WorkoutAnalytics: {
    detectPersonalRecords: jest.fn(),
    calculateMuscleGroupVolume: jest.fn(),
  },
}));

// The active workout is tracked by id in AsyncStorage, not by querying for an
// uncompleted `workout_logs` row.
jest.mock('@/utils/activeWorkoutStorage', () => ({
  clearActiveWorkoutLogId: jest.fn().mockResolvedValue(undefined),
  getActiveWorkoutLogId: jest.fn().mockResolvedValue(null),
  setActiveWorkoutLogId: jest.fn().mockResolvedValue(undefined),
}));

// `completeWorkout` does a best-effort calorie estimate and Health Connect sync after the
// workout is closed. Neither is under test here, so stub the collaborators they reach for.
jest.mock('../UserMetricService', () => ({
  UserMetricService: {
    getLatest: jest.fn().mockResolvedValue(null),
    getUserBodyWeightKgForVolume: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock('../UserService', () => ({
  UserService: {
    getCurrentUser: jest.fn().mockResolvedValue(null),
  },
}));

const mockDatabase = database as jest.Mocked<typeof database>;
const mockWorkoutAnalytics = WorkoutAnalytics as jest.Mocked<typeof WorkoutAnalytics>;
const mockGetActiveWorkoutLogId = getActiveWorkoutLogId as jest.MockedFunction<
  typeof getActiveWorkoutLogId
>;

/**
 * A collection stub that always answers both `find` and `query`. The service makes
 * incidental lookups around the call under test (calorie estimate, health sync); those
 * are caught and ignored by the service, but only if the collection responds at all.
 */
const collection = (overrides: { fetch?: jest.Mock; find?: jest.Mock } = {}) => ({
  create: jest.fn().mockResolvedValue({}),
  find: overrides.find ?? jest.fn().mockResolvedValue(null),
  prepareCreate: jest.fn().mockReturnValue({}),
  query: jest.fn().mockReturnValue({
    extend: jest.fn().mockReturnThis(),
    fetch: overrides.fetch ?? jest.fn().mockResolvedValue([]),
  }),
});

/**
 * Points `database.get(table)` at per-table rows. Reads that walk several tables in a
 * fixed order (`getWorkoutWithDetails`: log -> log exercises -> sets -> exercises) are
 * far easier to follow this way than as a chain of `mockReturnValueOnce`s. A table may
 * also be given an explicit collection override instead of a row list.
 */
function installTables(tables: Record<string, any[] | { find?: jest.Mock }>) {
  mockDatabase.get.mockImplementation((table: string) => {
    const entry = tables[table];
    if (!entry) {
      return collection() as any;
    }
    if (Array.isArray(entry)) {
      return collection({ fetch: jest.fn().mockResolvedValue(entry) }) as any;
    }
    return collection(entry) as any;
  });
}

describe('WorkoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearAllMocks` does not drain a `mockReturnValueOnce` queue, so a test that queues
    // more collections than the service consumes would leak into the next one.
    mockDatabase.get.mockReset();
    mockGetActiveWorkoutLogId.mockReset();
    mockGetActiveWorkoutLogId.mockResolvedValue(null);
    mockDatabase.get.mockReturnValue(collection() as any);
  });

  describe('startWorkoutFromTemplate', () => {
    it('should create workout from template successfully', async () => {
      const mockTemplate = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: null,
        startWorkout: jest.fn().mockResolvedValue(createMockWorkoutLog()),
      });

      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(mockTemplate) }) as any
      );

      const result = await WorkoutService.startWorkoutFromTemplate('template-1');

      expect(mockDatabase.get).toHaveBeenCalledWith('workout_templates');
      expect(mockTemplate.startWorkout).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw error when template is deleted', async () => {
      const mockTemplate = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: Date.now(),
      });

      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(mockTemplate) }) as any
      );

      await expect(WorkoutService.startWorkoutFromTemplate('template-1')).rejects.toThrow(
        'Cannot start workout from a deleted template'
      );
    });

    it('should throw error when active workout exists', async () => {
      const mockTemplate = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: null,
      });

      const activeWorkout = createMockWorkoutLog({
        id: 'workout-active',
        completedAt: null,
        deletedAt: null,
      });

      // A stored id whose workout is still open is what blocks a new workout.
      mockGetActiveWorkoutLogId.mockResolvedValue('workout-active');

      mockDatabase.get.mockImplementation(
        (table: string) =>
          collection({
            find: jest
              .fn()
              .mockResolvedValue(table === 'workout_templates' ? mockTemplate : activeWorkout),
          }) as any
      );

      await expect(WorkoutService.startWorkoutFromTemplate('template-1')).rejects.toThrow(
        'There is already an active workout. Please complete it first.'
      );
    });

    it('should handle template not found error', async () => {
      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockRejectedValue(new Error('Template not found')),
      } as any);

      await expect(WorkoutService.startWorkoutFromTemplate('template-1')).rejects.toThrow(
        'Failed to start workout'
      );
    });

    it('should wrap errors with descriptive messages', async () => {
      const mockTemplate = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: null,
        startWorkout: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(mockTemplate) }) as any
      );

      await expect(WorkoutService.startWorkoutFromTemplate('template-1')).rejects.toThrow(
        'Failed to start workout: Database error'
      );
    });

    it('should handle non-Error type exceptions', async () => {
      const mockTemplate = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: null,
        startWorkout: jest.fn().mockRejectedValue('String error'),
      });

      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(mockTemplate) }) as any
      );

      await expect(WorkoutService.startWorkoutFromTemplate('template-1')).rejects.toThrow(
        'Failed to start workout: Unknown error'
      );
    });

    it('should handle non-Error type exceptions from find', async () => {
      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockRejectedValue('String error from find') }) as any
      );

      await expect(WorkoutService.startWorkoutFromTemplate('template-1')).rejects.toThrow(
        'Failed to start workout: Unknown error'
      );
    });

    it('should handle non-Error type exceptions from the active-workout lookup', async () => {
      const mockTemplate = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: null,
        startWorkout: jest.fn().mockResolvedValue(createMockWorkoutLog()),
      });

      mockGetActiveWorkoutLogId.mockRejectedValue('String error from getActiveWorkoutLogId');

      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(mockTemplate) }) as any
      );

      await expect(WorkoutService.startWorkoutFromTemplate('template-1')).rejects.toThrow(
        'Failed to start workout: Unknown error'
      );
    });
  });

  describe('getActiveWorkout', () => {
    it('should return active workout when exists', async () => {
      const activeWorkout = createMockWorkoutLog({
        id: 'workout-1',
        completedAt: null,
        deletedAt: null,
      });

      mockGetActiveWorkoutLogId.mockResolvedValue('workout-1');
      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(activeWorkout) }) as any
      );

      const result = await WorkoutService.getActiveWorkout();

      expect(result).toBe(activeWorkout);
      expect(mockDatabase.get).toHaveBeenCalledWith('workout_logs');
    });

    it('should return null when no active workout', async () => {
      mockGetActiveWorkoutLogId.mockResolvedValue(null);

      const result = await WorkoutService.getActiveWorkout();

      expect(result).toBeNull();
    });

    it('should return the stored workout even when other workouts are still open', async () => {
      // The active workout is identified by the id in storage, so an unrelated
      // uncompleted log must not be picked up.
      const storedWorkout = createMockWorkoutLog({
        id: 'workout-2',
        completedAt: null,
        startedAt: Date.now(),
      });

      mockGetActiveWorkoutLogId.mockResolvedValue('workout-2');
      mockDatabase.get.mockReturnValue(
        collection({
          find: jest.fn(async (id: string) => {
            if (id !== 'workout-2') {
              throw new Error(`Unexpected lookup for ${id}`);
            }
            return storedWorkout;
          }),
        }) as any
      );

      const result = await WorkoutService.getActiveWorkout();

      expect(result).toBe(storedWorkout);
    });

    it('should filter out completed and deleted workouts', async () => {
      const completedWorkout = createMockWorkoutLog({
        id: 'workout-1',
        completedAt: Date.now(),
      });

      mockGetActiveWorkoutLogId.mockResolvedValue('workout-1');
      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(completedWorkout) }) as any
      );

      const result = await WorkoutService.getActiveWorkout();

      expect(result).toBeNull();
    });
  });

  describe('getWorkoutHistory', () => {
    it('should return completed workouts ordered by started_at desc', async () => {
      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      const workout2 = createMockWorkoutLog({
        id: 'workout-2',
        startedAt: Date.now(),
        completedAt: Date.now() + 500,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([workout2, workout1]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getWorkoutHistory();

      expect(result).toEqual([workout2, workout1]);
    });

    it('should filter by timeframe when provided', async () => {
      const workout = createMockWorkoutLog({
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      const timeframe = {
        startDate: Date.now() - 2000,
        endDate: Date.now(),
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([workout]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getWorkoutHistory(timeframe);

      expect(result).toEqual([workout]);
    });

    it('should respect limit parameter', async () => {
      const workout1 = createMockWorkoutLog({
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      const workout2 = createMockWorkoutLog({
        startedAt: Date.now(),
        completedAt: Date.now() + 500,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([workout2]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getWorkoutHistory(undefined, 1);

      expect(result).toEqual([workout2]);
    });

    it('should respect offset parameter with limit', async () => {
      const workout1 = createMockWorkoutLog({
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([workout1]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getWorkoutHistory(undefined, 10, 5);

      expect(mockQuery.extend).toHaveBeenCalled();
    });

    it('should filter out deleted workouts', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getWorkoutHistory();

      expect(result).toEqual([]);
    });

    it('should return empty array when no workouts', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getWorkoutHistory();

      expect(result).toEqual([]);
    });
  });

  describe('getUpcomingScheduledWorkouts', () => {
    it('should return templates for correct day of week', async () => {
      const date = new Date('2024-01-15'); // Monday
      const schedule = createMockSchedule({
        templateId: 'template-1',
        dayOfWeek: 'Monday',
      });

      const template = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: null,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValueOnce([schedule]).mockResolvedValueOnce([template]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getUpcomingScheduledWorkouts(date);

      expect(result).toEqual([template]);
    });

    it('should return empty array when no schedules for day', async () => {
      const date = new Date('2024-01-15'); // Monday

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getUpcomingScheduledWorkouts(date);

      expect(result).toEqual([]);
    });

    it('should filter out deleted templates and schedules', async () => {
      const date = new Date('2024-01-15'); // Monday

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getUpcomingScheduledWorkouts(date);

      expect(result).toEqual([]);
    });
  });

  describe('completeWorkout', () => {
    it('should complete workout successfully', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        completedAt: null,
        completeWorkout: jest.fn().mockResolvedValue(undefined),
      });

      const completedWorkout = createMockWorkoutLog({
        id: 'workout-1',
        completedAt: Date.now(),
      });

      const personalRecords = [
        {
          exerciseId: 'ex-1',
          exerciseName: 'Bench Press',
          type: 'volume' as const,
          previousBest: { weight: 100, reps: 10, volume: 1000, date: Date.now() },
          newRecord: { weight: 105, reps: 10, volume: 1050 },
        },
      ];

      mockDatabase.get.mockReturnValue(
        collection({
          find: jest.fn().mockResolvedValueOnce(workoutLog).mockResolvedValueOnce(completedWorkout),
        }) as any
      );

      mockWorkoutAnalytics.detectPersonalRecords.mockResolvedValue(personalRecords as any);

      const result = await WorkoutService.completeWorkout('workout-1');

      expect(workoutLog.completeWorkout).toHaveBeenCalled();
      expect(mockWorkoutAnalytics.detectPersonalRecords).toHaveBeenCalledWith(completedWorkout);
      expect(result.workoutLog).toBe(completedWorkout);
      expect(result.personalRecords).toEqual(personalRecords);
    });

    it('should throw error when workout already completed', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        completedAt: Date.now(),
      });

      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(workoutLog) }) as any
      );

      await expect(WorkoutService.completeWorkout('workout-1')).rejects.toThrow(
        'Workout is already completed'
      );
    });

    it('should handle workout not found error', async () => {
      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockRejectedValue(new Error('Workout not found')) }) as any
      );

      await expect(WorkoutService.completeWorkout('workout-1')).rejects.toThrow(
        'Failed to complete workout'
      );
    });

    it('should handle non-Error type exceptions', async () => {
      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockRejectedValue('String error') }) as any
      );

      await expect(WorkoutService.completeWorkout('workout-1')).rejects.toThrow(
        'Failed to complete workout: Unknown error'
      );
    });

    it('should handle non-Error type exceptions from completeWorkout method', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        completedAt: null,
        completeWorkout: jest.fn().mockRejectedValue('String error from completeWorkout'),
      });

      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(workoutLog) }) as any
      );

      await expect(WorkoutService.completeWorkout('workout-1')).rejects.toThrow(
        'Failed to complete workout: Unknown error'
      );
    });

    it('should handle non-Error type exceptions from detectPersonalRecords', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        completedAt: null,
        completeWorkout: jest.fn().mockResolvedValue(undefined),
      });

      const completedWorkout = createMockWorkoutLog({
        id: 'workout-1',
        completedAt: Date.now(),
      });

      mockDatabase.get.mockReturnValue(
        collection({
          find: jest.fn().mockResolvedValueOnce(workoutLog).mockResolvedValueOnce(completedWorkout),
        }) as any
      );

      mockWorkoutAnalytics.detectPersonalRecords.mockRejectedValue(
        'String error from detectPersonalRecords'
      );

      await expect(WorkoutService.completeWorkout('workout-1')).rejects.toThrow(
        'Failed to complete workout: Unknown error'
      );
    });
  });

  describe('getWorkoutStatistics', () => {
    it('should calculate total workouts correctly', async () => {
      const workout1 = createMockWorkoutLog({
        totalVolume: 1000,
      });

      const workout2 = createMockWorkoutLog({
        totalVolume: 2000,
      });

      const timeframe = {
        startDate: Date.now() - 10000,
        endDate: Date.now(),
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([workout1, workout2]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      mockWorkoutAnalytics.calculateMuscleGroupVolume.mockResolvedValue([]);

      const result = await WorkoutService.getWorkoutStatistics(timeframe);

      expect(result.totalWorkouts).toBe(2);
    });

    it('should calculate total volume correctly', async () => {
      const workout1 = createMockWorkoutLog({
        totalVolume: 1000,
      });

      const workout2 = createMockWorkoutLog({
        totalVolume: 2000,
      });

      const timeframe = {
        startDate: Date.now() - 10000,
        endDate: Date.now(),
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([workout1, workout2]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      mockWorkoutAnalytics.calculateMuscleGroupVolume.mockResolvedValue([]);

      const result = await WorkoutService.getWorkoutStatistics(timeframe);

      expect(result.totalVolume).toBe(3000);
    });

    it('should calculate average volume per workout', async () => {
      const workout1 = createMockWorkoutLog({
        totalVolume: 1000,
      });

      const workout2 = createMockWorkoutLog({
        totalVolume: 2000,
      });

      const timeframe = {
        startDate: Date.now() - 10000,
        endDate: Date.now(),
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([workout1, workout2]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      mockWorkoutAnalytics.calculateMuscleGroupVolume.mockResolvedValue([]);

      const result = await WorkoutService.getWorkoutStatistics(timeframe);

      expect(result.averageVolumePerWorkout).toBe(1500);
    });

    it('should call calculateMuscleGroupVolume with correct params', async () => {
      const workouts = [
        createMockWorkoutLog({ totalVolume: 1000 }),
        createMockWorkoutLog({ totalVolume: 2000 }),
      ];

      const timeframe = {
        startDate: Date.now() - 10000,
        endDate: Date.now(),
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue(workouts),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      mockWorkoutAnalytics.calculateMuscleGroupVolume.mockResolvedValue([]);

      await WorkoutService.getWorkoutStatistics(timeframe);

      expect(mockWorkoutAnalytics.calculateMuscleGroupVolume).toHaveBeenCalledWith(
        workouts,
        timeframe
      );
    });

    it('should handle empty workouts array (0 average)', async () => {
      const timeframe = {
        startDate: Date.now() - 10000,
        endDate: Date.now(),
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      mockWorkoutAnalytics.calculateMuscleGroupVolume.mockResolvedValue([]);

      const result = await WorkoutService.getWorkoutStatistics(timeframe);

      expect(result.averageVolumePerWorkout).toBe(0);
    });

    it('should handle workouts with null or undefined totalVolume', async () => {
      const workout1 = createMockWorkoutLog({
        totalVolume: 1000,
      });

      const workout2 = createMockWorkoutLog({
        totalVolume: null,
      });

      const workout3 = createMockWorkoutLog({
        totalVolume: undefined,
      });

      const workout4 = createMockWorkoutLog({
        totalVolume: 0,
      });

      const timeframe = {
        startDate: Date.now() - 10000,
        endDate: Date.now(),
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([workout1, workout2, workout3, workout4]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      mockWorkoutAnalytics.calculateMuscleGroupVolume.mockResolvedValue([]);

      const result = await WorkoutService.getWorkoutStatistics(timeframe);

      // Should only count workout1's volume (1000), others should default to 0
      expect(result.totalVolume).toBe(1000);
      expect(result.totalWorkouts).toBe(4);
      expect(result.averageVolumePerWorkout).toBe(250);
    });
  });

  describe('getWorkoutWithDetails', () => {
    it('should return workout with sets and exercises', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        deletedAt: null,
      });

      const logExercise1 = createMockWorkoutLogExercise({ id: 'le-1', exerciseId: 'ex-1' });
      const logExercise2 = createMockWorkoutLogExercise({ id: 'le-2', exerciseId: 'ex-2' });

      const set1 = createMockWorkoutLogSet({
        id: 'set-1',
        logExerciseId: 'le-1',
        setOrder: 1,
      });

      const set2 = createMockWorkoutLogSet({
        id: 'set-2',
        logExerciseId: 'le-2',
        setOrder: 2,
      });

      const exercise1 = createMockExercise({ id: 'ex-1' });
      const exercise2 = createMockExercise({ id: 'ex-2' });

      installTables({
        exercises: [exercise1, exercise2],
        workout_log_exercises: [logExercise1, logExercise2],
        workout_log_sets: [set1, set2],
        workout_logs: { find: jest.fn().mockResolvedValue(workoutLog) },
      });

      const result = await WorkoutService.getWorkoutWithDetails('workout-1');

      expect(result.workoutLog).toBe(workoutLog);
      // Sets come back enriched with the exercise their log-exercise points at.
      expect(result.sets.map((s) => [s.id, s.exerciseId])).toEqual([
        ['set-1', 'ex-1'],
        ['set-2', 'ex-2'],
      ]);
      expect(result.exercises).toEqual([exercise1, exercise2]);
    });

    it('should get sets ordered by set_order asc', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        deletedAt: null,
      });

      const logExercise = createMockWorkoutLogExercise({ id: 'le-1', exerciseId: 'ex-1' });
      const set1 = createMockWorkoutLogSet({ id: 'set-1', logExerciseId: 'le-1', setOrder: 1 });
      const set2 = createMockWorkoutLogSet({ id: 'set-2', logExerciseId: 'le-1', setOrder: 2 });

      installTables({
        workout_log_exercises: [logExercise],
        workout_log_sets: [set1, set2],
        workout_logs: { find: jest.fn().mockResolvedValue(workoutLog) },
      });

      const result = await WorkoutService.getWorkoutWithDetails('workout-1');

      expect(result.sets.map((s) => s.setOrder)).toEqual([1, 2]);
    });

    it('should get unique exercises for sets', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        deletedAt: null,
      });

      // Two log exercises point at ex-1 and one at ex-2, so the exercise lookup must dedupe.
      const logExercise1 = createMockWorkoutLogExercise({ id: 'le-1', exerciseId: 'ex-1' });
      const logExercise2 = createMockWorkoutLogExercise({ id: 'le-2', exerciseId: 'ex-1' });
      const logExercise3 = createMockWorkoutLogExercise({ id: 'le-3', exerciseId: 'ex-2' });

      const set1 = createMockWorkoutLogSet({ id: 'set-1', logExerciseId: 'le-1' });
      const set2 = createMockWorkoutLogSet({ id: 'set-2', logExerciseId: 'le-2' });
      const set3 = createMockWorkoutLogSet({ id: 'set-3', logExerciseId: 'le-3' });

      const exercise1 = createMockExercise({ id: 'ex-1' });
      const exercise2 = createMockExercise({ id: 'ex-2' });

      installTables({
        exercises: [exercise1, exercise2],
        workout_log_exercises: [logExercise1, logExercise2, logExercise3],
        workout_log_sets: [set1, set2, set3],
        workout_logs: { find: jest.fn().mockResolvedValue(workoutLog) },
      });

      const result = await WorkoutService.getWorkoutWithDetails('workout-1');

      expect(result.exercises).toHaveLength(2);
    });

    it('should filter out deleted sets', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        deletedAt: null,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(workoutLog),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
        } as any);

      const result = await WorkoutService.getWorkoutWithDetails('workout-1');

      expect(result.sets).toEqual([]);
    });

    it('should throw error when workout is deleted', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        deletedAt: Date.now(),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      // Reset mock to ensure clean state
      mockDatabase.get.mockReset();
      mockDatabase.get
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(workoutLog),
        } as any)
        .mockReturnValue({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any);

      await expect(WorkoutService.getWorkoutWithDetails('workout-1')).rejects.toThrow(
        'Workout log has been deleted'
      );
    });
  });

  describe('getWorkoutLogsByTemplate', () => {
    it('should return logs for specific template', async () => {
      const workout1 = createMockWorkoutLog({
        templateId: 'template-1',
        completedAt: Date.now(),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([workout1]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getWorkoutLogsByTemplate('template-1');

      expect(result).toEqual([workout1]);
    });

    it('should filter completed workouts only', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getWorkoutLogsByTemplate('template-1');

      expect(result).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const workout1 = createMockWorkoutLog({
        templateId: 'template-1',
        completedAt: Date.now(),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([workout1]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getWorkoutLogsByTemplate('template-1', 1);

      expect(result).toEqual([workout1]);
    });

    it('should order by started_at desc', async () => {
      const workout1 = createMockWorkoutLog({
        templateId: 'template-1',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      const workout2 = createMockWorkoutLog({
        templateId: 'template-1',
        startedAt: Date.now(),
        completedAt: Date.now() + 500,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([workout2, workout1]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getWorkoutLogsByTemplate('template-1');

      expect(result).toEqual([workout2, workout1]);
    });

    it('should filter out deleted workouts', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getWorkoutLogsByTemplate('template-1');

      expect(result).toEqual([]);
    });
  });
});
