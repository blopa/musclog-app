import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { GymService } from '@/database/services/GymService';
import { SettingsService } from '@/database/services/SettingsService';
import { WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import { ActiveWorkoutExistsError, WorkoutService } from '@/database/services/WorkoutService';
import {
  clearActiveWorkoutLogId,
  getActiveWorkoutLogId,
  setActiveWorkoutLogId,
} from '@/utils/activeWorkoutStorage';

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

  // Model `markAsDeleted` methods are `@writer`s, so a service holding an open write block
  // has to reach them through `writer.callWriter`. Real WatermelonDB throws
  // "callReader/callWriter call must call a reader/writer synchronously" when the callback
  // is not a writer, and deadlocks when a writer is called without it — neither is
  // observable through a bare `{}` writer, so expose the spy and let tests assert on it.
  const mockCallWriter = jest.fn((work: () => unknown) => Promise.resolve(work()));
  const mockWriter = { callWriter: mockCallWriter } as any;

  return {
    database: {
      get: jest.fn().mockReturnValue(mockCollection),
      write: jest.fn((callback) => Promise.resolve(callback(mockWriter))),
      batch: jest.fn().mockResolvedValue(undefined),
      collections: {
        get: jest.fn().mockReturnValue(mockCollection),
      },
    },
    __callWriter: mockCallWriter,
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

jest.mock('@/services/healthConnectWorkout', () => ({
  writeWorkoutToHealthConnect: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../UserService', () => ({
  UserService: {
    getCurrentUser: jest.fn().mockResolvedValue(null),
  },
}));

const mockDatabase = database as jest.Mocked<typeof database>;
const { __callWriter: mockCallWriter } = jest.requireMock('../../database-instance') as {
  __callWriter: jest.Mock;
};
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

    it('threads the selected plan context into the workout log creation', async () => {
      const mockTemplate = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: null,
        startWorkout: jest.fn().mockResolvedValue(createMockWorkoutLog()),
      });
      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(mockTemplate) }) as any
      );

      await WorkoutService.startWorkoutFromTemplate('template-1', 'plan-1');

      expect(mockTemplate.startWorkout).toHaveBeenCalledWith('plan-1');
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

      const attempt = WorkoutService.startWorkoutFromTemplate('template-1');
      // Rethrown as its own type, unwrapped, so the screen can explain the refusal instead of
      // reporting it to Sentry as "Failed to start workout".
      await expect(attempt).rejects.toBeInstanceOf(ActiveWorkoutExistsError);
      await expect(attempt).rejects.toThrow(
        'There is already an active workout. Please complete it first.'
      );
      expect(mockTemplate.startWorkout).not.toHaveBeenCalled();
      expect(clearActiveWorkoutLogId).not.toHaveBeenCalled();
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

  describe('startFreeWorkout', () => {
    it('refuses while another workout is still open, keeping it active', async () => {
      const activeWorkout = createMockWorkoutLog({
        id: 'workout-active',
        completedAt: null,
        deletedAt: null,
      });
      mockGetActiveWorkoutLogId.mockResolvedValue('workout-active');
      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(activeWorkout) }) as any
      );

      // The guard used to sit inside the lookup's try, so its own catch swallowed it, cleared
      // the open session's id and started a second workout on top of it.
      await expect(WorkoutService.startFreeWorkout('Free')).rejects.toBeInstanceOf(
        ActiveWorkoutExistsError
      );
      expect(clearActiveWorkoutLogId).not.toHaveBeenCalled();
      expect(mockDatabase.write).not.toHaveBeenCalled();
      expect(setActiveWorkoutLogId).not.toHaveBeenCalled();
    });

    it('starts when the stored active workout was already completed', async () => {
      const finished = createMockWorkoutLog({
        id: 'workout-done',
        completedAt: Date.now(),
        deletedAt: null,
      });
      const created = createMockWorkoutLog({ id: 'workout-new' });
      mockGetActiveWorkoutLogId.mockResolvedValue('workout-done');
      mockDatabase.get.mockReturnValue({
        ...collection({ find: jest.fn().mockResolvedValue(finished) }),
        create: jest.fn().mockResolvedValue(created),
      } as any);

      await expect(WorkoutService.startFreeWorkout('Free')).resolves.toBe(created);
      expect(clearActiveWorkoutLogId).toHaveBeenCalled();
      expect(setActiveWorkoutLogId).toHaveBeenCalledWith('workout-new');
    });

    it('starts when the stored active workout no longer exists', async () => {
      const created = createMockWorkoutLog({ id: 'workout-new' });
      mockGetActiveWorkoutLogId.mockResolvedValue('workout-gone');
      mockDatabase.get.mockReturnValue({
        ...collection({ find: jest.fn().mockRejectedValue(new Error('not found')) }),
        create: jest.fn().mockResolvedValue(created),
      } as any);

      await expect(WorkoutService.startFreeWorkout('Free')).resolves.toBe(created);
      expect(clearActiveWorkoutLogId).toHaveBeenCalled();
      expect(setActiveWorkoutLogId).toHaveBeenCalledWith('workout-new');
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

      installTables({
        workout_plans: [],
        workout_plan_templates: [],
        schedules: [schedule],
        workout_templates: [template],
      });

      const result = await WorkoutService.getUpcomingScheduledWorkouts(date);

      expect(result).toEqual([template]);
      expect(Q.where).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should return empty array when no schedules for day', async () => {
      const date = new Date('2024-01-15'); // Monday

      installTables({ workout_plans: [], workout_plan_templates: [], schedules: [] });

      const result = await WorkoutService.getUpcomingScheduledWorkouts(date);

      expect(result).toEqual([]);
    });

    it('uses weekly membership days and ignores a planned template standalone schedule', async () => {
      const date = new Date('2024-01-15'); // Monday
      const template = createMockWorkoutTemplate({ id: 'template-1', deletedAt: null });
      installTables({
        workout_plans: [{ id: 'plan-1', cycleType: 'weekly' }],
        workout_plan_templates: [{ planId: 'plan-1', templateId: 'template-1', weekDays: [0] }],
        schedules: [createMockSchedule({ templateId: 'template-1', dayOfWeek: 'Friday' })],
        workout_templates: [template],
      });

      const result = await WorkoutService.getUpcomingScheduledWorkouts(date);

      expect(result).toEqual([template]);
    });

    it('excludes rotating members and reactivates standalone rows after unfiling', async () => {
      const date = new Date('2024-01-19'); // Friday
      const template = createMockWorkoutTemplate({ id: 'template-1', deletedAt: null });
      installTables({
        workout_plans: [{ id: 'rotation', cycleType: 'rotating' }],
        workout_plan_templates: [{ planId: 'rotation', templateId: 'template-1', position: 0 }],
        schedules: [createMockSchedule({ templateId: 'template-1', dayOfWeek: 'Friday' })],
        workout_templates: [template],
      });

      expect(await WorkoutService.getUpcomingScheduledWorkouts(date)).toEqual([]);

      installTables({
        workout_plans: [{ id: 'rotation', cycleType: 'rotating' }],
        workout_plan_templates: [],
        schedules: [createMockSchedule({ templateId: 'template-1', dayOfWeek: 'Friday' })],
        workout_templates: [template],
      });
      expect(await WorkoutService.getUpcomingScheduledWorkouts(date)).toEqual([template]);
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

  describe('updateWorkoutSets', () => {
    it('rejects the complete edit before opening a writer when any set is invalid', async () => {
      await expect(
        WorkoutService.updateWorkoutSets('workout-1', [
          { setId: 'valid-set', difficultyLevel: 8 },
          { setId: 'invalid-set', difficultyLevel: 0 },
        ])
      ).rejects.toThrow('Difficulty level must be between 1 and 10');

      expect(mockDatabase.write).not.toHaveBeenCalled();
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });

    it('resolves every set before preparing changes, so a lookup failure leaves no partial edit', async () => {
      const firstSet = {
        id: 'set-1',
        logExerciseId: 'log-exercise-1',
        prepareUpdate: jest.fn(),
      };
      const setFind = jest.fn(async (setId: string) => {
        if (setId === firstSet.id) {
          return firstSet;
        }
        throw new Error(`Workout set ${setId} not found`);
      });
      const setFetch = jest.fn(async () => {
        return [firstSet];
      });
      const workoutLog = createMockWorkoutLog({ id: 'workout-1', deletedAt: null });
      const logExercise = createMockWorkoutLogExercise({
        id: 'log-exercise-1',
        workoutLogId: workoutLog.id,
      });

      mockDatabase.get.mockImplementation((table: string) => {
        if (table === 'workout_logs') {
          return collection({ find: jest.fn().mockResolvedValue(workoutLog) }) as never;
        }
        if (table === 'workout_log_exercises') {
          return collection({ fetch: jest.fn().mockResolvedValue([logExercise]) }) as never;
        }
        if (table === 'workout_log_sets') {
          return collection({ find: setFind, fetch: setFetch }) as never;
        }
        return collection() as never;
      });

      await expect(
        WorkoutService.updateWorkoutSets('workout-1', [
          { setId: 'set-1', reps: 10 },
          { setId: 'missing-set', reps: 12 },
        ])
      ).rejects.toThrow('Failed to update workout sets: Workout set missing-set not found');

      expect(firstSet.prepareUpdate).not.toHaveBeenCalled();
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });

    it('resolves deletions with one query, and a missing id leaves no partial edit', async () => {
      const existingSet = {
        id: 'set-1',
        logExerciseId: 'log-exercise-1',
        prepareUpdate: jest.fn(),
      };
      const setFetch = jest.fn(async () => [existingSet]);
      const workoutLog = createMockWorkoutLog({ id: 'workout-1', deletedAt: null });
      const logExercise = createMockWorkoutLogExercise({
        id: 'log-exercise-1',
        workoutLogId: workoutLog.id,
      });
      const setsCollection = collection({ fetch: setFetch });

      mockDatabase.get.mockImplementation((table: string) => {
        if (table === 'workout_logs') {
          return collection({ find: jest.fn().mockResolvedValue(workoutLog) }) as never;
        }
        if (table === 'workout_log_exercises') {
          return collection({ fetch: jest.fn().mockResolvedValue([logExercise]) }) as never;
        }
        if (table === 'workout_log_sets') {
          return setsCollection as never;
        }
        return collection() as never;
      });

      await expect(
        WorkoutService.updateWorkoutSets('workout-1', [], ['set-1', 'missing-set'])
      ).rejects.toThrow('Failed to update workout sets: Workout set missing-set not found');

      // One batched lookup covering deletions and updates together, not one `find` each.
      expect(setsCollection.query).toHaveBeenCalledTimes(1);
      expect(setsCollection.find).not.toHaveBeenCalled();
      expect(existingSet.prepareUpdate).not.toHaveBeenCalled();
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });
  });

  describe('reorderWorkoutLogExercises', () => {
    it('aborts on an unknown exercise id rather than renumbering the survivors', async () => {
      // Silently skipping a missing id used to leave the remaining exercises reordered and
      // their sets renumbered against a list the caller never asked for.
      const known = { id: 'log-exercise-1', prepareUpdate: jest.fn() };
      const exercisesCollection = collection({ fetch: jest.fn().mockResolvedValue([known]) });

      mockDatabase.get.mockImplementation((table: string) => {
        if (table === 'workout_logs') {
          return collection({
            find: jest.fn().mockResolvedValue(createMockWorkoutLog({ id: 'workout-1' })),
          }) as never;
        }
        if (table === 'workout_log_exercises') {
          return exercisesCollection as never;
        }
        return collection() as never;
      });

      await expect(
        WorkoutService.reorderWorkoutLogExercises('workout-1', [
          { id: 'log-exercise-1' },
          { id: 'log-exercise-gone' },
        ])
      ).rejects.toThrow('Workout log exercise log-exercise-gone not found');

      expect(known.prepareUpdate).not.toHaveBeenCalled();
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });

    it('fetches the exercises and their sets in one query each, not one per exercise', async () => {
      const ordered = ['log-exercise-1', 'log-exercise-2', 'log-exercise-3'];
      const rows = ordered.map((id) => ({ id, prepareUpdate: jest.fn().mockReturnValue({ id }) }));
      const exercisesCollection = collection({ fetch: jest.fn().mockResolvedValue(rows) });
      const setsCollection = collection({
        fetch: jest.fn().mockResolvedValue([
          { id: 'set-2', logExerciseId: 'log-exercise-1', setOrder: 2, prepareUpdate: jest.fn() },
          { id: 'set-1', logExerciseId: 'log-exercise-1', setOrder: 1, prepareUpdate: jest.fn() },
        ]),
      });

      mockDatabase.get.mockImplementation((table: string) => {
        if (table === 'workout_logs') {
          return collection({
            find: jest.fn().mockResolvedValue(createMockWorkoutLog({ id: 'workout-1' })),
          }) as never;
        }
        if (table === 'workout_log_exercises') {
          return exercisesCollection as never;
        }
        if (table === 'workout_log_sets') {
          return setsCollection as never;
        }
        return collection() as never;
      });

      await WorkoutService.reorderWorkoutLogExercises(
        'workout-1',
        ordered.map((id) => ({ id }))
      );

      expect(exercisesCollection.query).toHaveBeenCalledTimes(1);
      expect(setsCollection.query).toHaveBeenCalledTimes(1);
      expect(exercisesCollection.find).not.toHaveBeenCalled();
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

    it('returns migrated skipped template placeholders without read-time repair', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        completedAt: Date.now(),
        deletedAt: null,
      });
      const performedLogExercise = createMockWorkoutLogExercise({
        id: 'le-performed',
        exerciseId: 'ex-performed',
      });
      const untouchedLogExercise = createMockWorkoutLogExercise({
        id: 'le-untouched',
        exerciseId: 'ex-untouched',
      });
      const skippedLogExercise = createMockWorkoutLogExercise({
        id: 'le-skipped',
        exerciseId: 'ex-skipped',
      });
      const performedSet = createMockWorkoutLogSet({
        id: 'set-performed',
        logExerciseId: performedLogExercise.id,
        completionStatus: 'performed',
        difficultyLevel: 8,
      });
      const untouchedSet = createMockWorkoutLogSet({
        id: 'set-untouched',
        logExerciseId: untouchedLogExercise.id,
        completionStatus: 'skipped',
        difficultyLevel: undefined,
      });
      const skippedSet = createMockWorkoutLogSet({
        id: 'set-skipped',
        logExerciseId: skippedLogExercise.id,
        completionStatus: 'skipped',
        difficultyLevel: undefined,
      });
      const performedExercise = createMockExercise({ id: 'ex-performed' });
      const untouchedExercise = createMockExercise({ id: 'ex-untouched' });
      const skippedExercise = createMockExercise({ id: 'ex-skipped' });

      installTables({
        exercises: [performedExercise, untouchedExercise, skippedExercise],
        workout_log_exercises: [performedLogExercise, untouchedLogExercise, skippedLogExercise],
        workout_log_sets: [performedSet, untouchedSet, skippedSet],
        workout_logs: { find: jest.fn().mockResolvedValue(workoutLog) },
      });

      const result = await WorkoutService.getWorkoutWithDetails('workout-1');

      expect(result.sets.map((set) => [set.id, set.isSkipped])).toEqual([
        ['set-performed', false],
        ['set-untouched', true],
        ['set-skipped', true],
      ]);
      expect(result.logExercises.map((exercise) => exercise.id)).toEqual([
        'le-performed',
        'le-untouched',
        'le-skipped',
      ]);
      expect(result.exercises).toEqual([performedExercise, untouchedExercise, skippedExercise]);
      expect(Q.oneOf).toHaveBeenLastCalledWith(['ex-performed', 'ex-untouched', 'ex-skipped']);
    });

    it('keeps explicitly performed imported sets without fabricating an RPE', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'imported-workout',
        templateId: undefined,
        completedAt: Date.now(),
        deletedAt: null,
      });
      const logExercise = createMockWorkoutLogExercise({
        id: 'imported-log-exercise',
        exerciseId: 'imported-exercise',
      });
      const importedSet = createMockWorkoutLogSet({
        id: 'imported-set',
        logExerciseId: logExercise.id,
        completionStatus: 'performed',
        difficultyLevel: undefined,
      });
      const exercise = createMockExercise({ id: 'imported-exercise' });

      installTables({
        exercises: [exercise],
        workout_log_exercises: [logExercise],
        workout_log_sets: [importedSet],
        workout_logs: { find: jest.fn().mockResolvedValue(workoutLog) },
      });

      const result = await WorkoutService.getWorkoutWithDetails(workoutLog.id);

      expect(result.sets.map((set) => set.id)).toEqual(['imported-set']);
      expect(result.logExercises).toEqual([logExercise]);
      expect(result.exercises).toEqual([exercise]);
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

  describe('deleteWorkoutLog', () => {
    /**
     * `WorkoutLog` was the one model that never overrode `markAsDeleted`, so this call
     * landed on WatermelonDB's base implementation — which is not a `@writer` and so never
     * satisfies `callWriter`'s "must call a writer synchronously" invariant. Every delete
     * threw, after the log itself had already been tombstoned, leaving its exercises and
     * sets behind. Assert the whole tree is soft-deleted through the open writer.
     */
    it('soft-deletes the log and its exercises and sets through the open writer', async () => {
      const workoutLog = createMockWorkoutLog({ markAsDeleted: jest.fn() });
      const logExercise = createMockWorkoutLogExercise({
        id: 'log-exercise-1',
        markAsDeleted: jest.fn(),
      });
      const set = createMockWorkoutLogSet({ id: 'set-1', markAsDeleted: jest.fn() });

      installTables({
        workout_log_exercises: [logExercise],
        workout_log_sets: [set],
        workout_logs: { find: jest.fn().mockResolvedValue(workoutLog) },
      });

      await WorkoutService.deleteWorkoutLog(workoutLog.id);

      expect(workoutLog.markAsDeleted).toHaveBeenCalledTimes(1);
      expect(logExercise.markAsDeleted).toHaveBeenCalledTimes(1);
      expect(set.markAsDeleted).toHaveBeenCalledTimes(1);
      // Every one of them is a `@writer`, so every one has to join the open transaction.
      expect(mockCallWriter).toHaveBeenCalledTimes(3);
    });
  });

  describe('replaceLogExercise', () => {
    /** A log exercise / set stand-in whose `prepareUpdate` applies the updater immediately. */
    const record = (fields: Record<string, unknown>) => {
      const row: any = { ...fields };
      row.prepareUpdate = jest.fn((updater: (draft: any) => void) => {
        updater(row);
        return row;
      });
      return row;
    };

    it('swaps the block and records what it replaced and why, in one batch', async () => {
      const block = record({ id: 'le-1', exerciseId: 'bench', updatedAt: 1 });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutService.replaceLogExercise('le-1', 'db-bench', { reason: 'pain' });

      expect(block).toMatchObject({
        exerciseId: 'db-bench',
        replacedExerciseId: 'bench',
        substitutionReason: 'pain',
      });
      expect(block.updatedAt).toBeGreaterThan(1);
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    });

    it('never touches the template the session came from', async () => {
      const block = record({ id: 'le-1', exerciseId: 'bench', templateExerciseId: 'tpl-ex-1' });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutService.replaceLogExercise('le-1', 'db-bench', { reason: 'just_today' });

      const touched = mockDatabase.get.mock.calls.map(([table]) => table);
      expect(touched).not.toContain('workout_template_exercises');
      expect(touched).not.toContain('workout_template_sets');
      expect(block.templateExerciseId).toBe('tpl-ex-1');
    });

    it('keeps the ORIGINAL exercise when a block is swapped a second time', async () => {
      const block = record({ id: 'le-1', exerciseId: 'db-bench', replacedExerciseId: 'bench' });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutService.replaceLogExercise('le-1', 'machine-press', { reason: 'too_hard' });

      expect(block).toMatchObject({
        exerciseId: 'machine-press',
        replacedExerciseId: 'bench',
        substitutionReason: 'too_hard',
      });
    });

    it('resets only the still-planned sets to the new exercise load', async () => {
      const block = record({ id: 'le-1', exerciseId: 'bench' });
      const plannedA = record({ id: 's1', weight: 80, completionStatus: 'planned' });
      const plannedB = record({ id: 's2', weight: 80, completionStatus: 'planned' });
      installTables({
        workout_log_exercises: { find: jest.fn().mockResolvedValue(block) },
        workout_log_sets: [plannedA, plannedB],
      });

      await WorkoutService.replaceLogExercise('le-1', 'fly', {
        reason: 'equipment_unavailable',
        plannedWeightKg: 12.5,
      });

      expect(plannedA.weight).toBe(12.5);
      expect(plannedB.weight).toBe(12.5);
      // The query that finds them must ask for planned sets only: history is never rewritten.
      expect(Q.where).toHaveBeenCalledWith('completion_status', 'planned');
      expect(mockDatabase.batch).toHaveBeenCalledWith(block, plannedA, plannedB);
    });

    it('leaves set weights alone when no planned weight is given', async () => {
      const block = record({ id: 'le-1', exerciseId: 'bench' });
      const planned = record({ id: 's1', weight: 80, completionStatus: 'planned' });
      installTables({
        workout_log_exercises: { find: jest.fn().mockResolvedValue(block) },
        workout_log_sets: [planned],
      });

      await WorkoutService.replaceLogExercise('le-1', 'fly', { reason: 'dislike' });

      expect(planned.weight).toBe(80);
      expect(mockDatabase.batch).toHaveBeenCalledWith(block);
    });

    it('is a no-op when the exercise does not change', async () => {
      const block = record({ id: 'le-1', exerciseId: 'bench' });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutService.replaceLogExercise('le-1', 'bench', { reason: 'pain' });

      expect(mockDatabase.batch).not.toHaveBeenCalled();
      expect(block.substitutionReason).toBeUndefined();
    });
  });

  describe('logCardioSession', () => {
    const { UserMetricService } = jest.requireMock('../UserMetricService') as {
      UserMetricService: { getUserBodyWeightKgForVolume: jest.Mock };
    };
    const { writeWorkoutToHealthConnect } = jest.requireMock('@/services/healthConnectWorkout') as {
      writeWorkoutToHealthConnect: jest.Mock;
    };

    /** Records what `prepareCreate` was asked to build, keyed by table. */
    function captureCreates() {
      const created: Record<string, any[]> = {};
      mockDatabase.get.mockImplementation((table: string) => {
        return {
          ...collection(),
          prepareCreate: jest.fn((builder: (record: any) => void) => {
            const record: any = { id: `${table}-${(created[table]?.length ?? 0) + 1}` };
            builder(record);
            record.update = jest.fn(async (updater: (r: any) => void) => updater(record));
            (created[table] ??= []).push(record);
            return record;
          }),
        } as any;
      });
      return created;
    }

    const base = {
      activity: 'run' as const,
      distanceM: 5000,
      durationS: 1800,
      endedAt: 1_700_000_000_000,
      workoutName: 'Run',
    };

    beforeEach(() => {
      UserMetricService.getUserBodyWeightKgForVolume.mockResolvedValue(70);
      writeWorkoutToHealthConnect.mockClear();
    });

    it('writes one completed cardio log and one exercise, and NO sets, in a single batch', async () => {
      const created = captureCreates();

      await WorkoutService.logCardioSession(base);

      expect(created.workout_logs).toHaveLength(1);
      expect(created.workout_log_exercises).toHaveLength(1);
      expect(created.workout_log_sets).toBeUndefined();
      // One writer for the whole log; a second write happens only to stamp a health record id.
      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      expect(mockDatabase.batch).toHaveBeenCalledWith(
        created.workout_logs[0],
        created.workout_log_exercises[0]
      );
    });

    it('stamps the activity, the distance and a window that ends where it was told to', async () => {
      const created = captureCreates();

      await WorkoutService.logCardioSession(base);

      expect(created.workout_logs[0]).toMatchObject({
        type: 'cardio',
        activity: 'run',
        distanceM: 5000,
        completedAt: base.endedAt,
        startedAt: base.endedAt - 1800 * 1000,
        totalVolume: 0,
        workoutName: 'Run',
        timezone: expect.any(String),
      });
    });

    it('estimates calories from body mass, and lets a watch figure win', async () => {
      let created = captureCreates();
      await WorkoutService.logCardioSession(base);
      expect(created.workout_logs[0].caloriesBurned).toBe(387);

      created = captureCreates();
      await WorkoutService.logCardioSession({ ...base, caloriesOverride: 450 });
      expect(created.workout_logs[0].caloriesBurned).toBe(450);
    });

    it('stores no calories at all when it cannot estimate them (no body weight yet)', async () => {
      UserMetricService.getUserBodyWeightKgForVolume.mockResolvedValue(0);
      const created = captureCreates();

      await WorkoutService.logCardioSession(base);

      expect(created.workout_logs[0].caloriesBurned).toBeUndefined();
    });

    it.each([
      [{ activity: 'walk' as const }, false, 'fx-Trail_Running_Walking'],
      [{ activity: 'run' as const }, false, 'fx-Trail_Running_Walking'],
      [{ activity: 'walk' as const }, true, 'fx-Walking_Treadmill'],
      [{ activity: 'run' as const }, true, 'fx-Running_Treadmill'],
    ])('points %p (treadmill: %p) at %s', async (override, treadmill, exerciseId) => {
      const created = captureCreates();

      await WorkoutService.logCardioSession({ ...base, ...override, treadmill });

      expect(created.workout_log_exercises[0].exerciseId).toBe(exerciseId);
    });

    it.each([
      ['no distance', { distanceM: 0 }],
      ['a negative distance', { distanceM: -5 }],
      ['no duration', { durationS: 0 }],
      ['more than a day', { durationS: 24 * 3600 + 1 }],
      ['an unknown activity', { activity: 'swim' as never }],
    ])('refuses %s before writing anything', async (_label, override) => {
      captureCreates();

      await expect(WorkoutService.logCardioSession({ ...base, ...override })).rejects.toThrow();

      expect(mockDatabase.write).not.toHaveBeenCalled();
    });

    it('hands the health write the activity and distance, and keeps its record id', async () => {
      const created = captureCreates();
      writeWorkoutToHealthConnect.mockResolvedValueOnce('hc-1');

      await WorkoutService.logCardioSession(base);

      expect(writeWorkoutToHealthConnect).toHaveBeenCalledWith(
        expect.objectContaining({ activity: 'run', distanceM: 5000, workoutType: 'cardio' })
      );
      expect(created.workout_logs[0].externalId).toBe('hc-1');
    });

    it('still returns the log when the health write fails', async () => {
      captureCreates();
      writeWorkoutToHealthConnect.mockRejectedValueOnce(new Error('no permission'));

      await expect(WorkoutService.logCardioSession(base)).resolves.toMatchObject({
        activity: 'run',
      });
    });
  });

  describe('saveLogExerciseNote', () => {
    const record = (fields: Record<string, unknown>) => {
      const row: any = { ...fields };
      row.prepareUpdate = jest.fn((updater: (draft: any) => void) => {
        updater(row);
        return row;
      });
      return row;
    };

    it('writes the note onto the log exercise in one batch', async () => {
      const block = record({ id: 'le-1', notes: undefined, updatedAt: 1 });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      const result = await WorkoutService.saveLogExerciseNote('le-1', '  slow negatives  ');

      expect(block.notes).toBe('slow negatives');
      expect(block.updatedAt).toBeGreaterThan(1);
      expect(result).toEqual({ savedToTemplate: false });
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    });

    it('clears the note when it is blank', async () => {
      const block = record({ id: 'le-1', notes: 'old' });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutService.saveLogExerciseNote('le-1', '   ');

      expect(block.notes).toBeUndefined();
    });

    it('leaves the template alone unless asked', async () => {
      const block = record({ id: 'le-1', templateExerciseId: 'tpl-1' });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutService.saveLogExerciseNote('le-1', 'brace');

      expect(mockDatabase.get.mock.calls.map(([table]) => table)).not.toContain(
        'workout_template_exercises'
      );
    });

    it('copies the note to the template exercise in the SAME batch when asked', async () => {
      const block = record({ id: 'le-1', templateExerciseId: 'tpl-1' });
      const template = record({ id: 'tpl-1', notes: undefined, deletedAt: null });
      installTables({
        workout_log_exercises: { find: jest.fn().mockResolvedValue(block) },
        workout_template_exercises: { find: jest.fn().mockResolvedValue(template) },
      });

      const result = await WorkoutService.saveLogExerciseNote('le-1', 'brace', {
        alsoSaveToTemplate: true,
      });

      expect(template.notes).toBe('brace');
      expect(result).toEqual({ savedToTemplate: true });
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      expect(mockDatabase.batch).toHaveBeenCalledWith(block, template);
    });

    it('reports that the template was not updated when the block was added mid-session', async () => {
      const block = record({ id: 'le-1', templateExerciseId: undefined });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      const result = await WorkoutService.saveLogExerciseNote('le-1', 'brace', {
        alsoSaveToTemplate: true,
      });

      expect(result).toEqual({ savedToTemplate: false });
      expect(block.notes).toBe('brace');
    });

    it('does not resurrect a template exercise that has since been deleted', async () => {
      const block = record({ id: 'le-1', templateExerciseId: 'tpl-1' });
      const template = record({ id: 'tpl-1', notes: 'keep me', deletedAt: 123 });
      installTables({
        workout_log_exercises: { find: jest.fn().mockResolvedValue(block) },
        workout_template_exercises: { find: jest.fn().mockResolvedValue(template) },
      });

      const result = await WorkoutService.saveLogExerciseNote('le-1', 'brace', {
        alsoSaveToTemplate: true,
      });

      expect(result).toEqual({ savedToTemplate: false });
      expect(template.notes).toBe('keep me');
      expect(block.notes).toBe('brace');
    });

    it('still saves the session note when the template lookup fails', async () => {
      const block = record({ id: 'le-1', templateExerciseId: 'tpl-1' });
      installTables({
        workout_log_exercises: { find: jest.fn().mockResolvedValue(block) },
        workout_template_exercises: { find: jest.fn().mockRejectedValue(new Error('not found')) },
      });

      const result = await WorkoutService.saveLogExerciseNote('le-1', 'brace', {
        alsoSaveToTemplate: true,
      });

      expect(result).toEqual({ savedToTemplate: false });
      expect(block.notes).toBe('brace');
    });
  });

  describe('warm-up sets', () => {
    const setRecord = (fields: Record<string, unknown>) => {
      const row: any = { weight: 100, reps: 5, restTimeAfter: 60, deletedAt: null, ...fields };
      row.prepareUpdate = jest.fn((updater: (draft: any) => void) => {
        updater(row);
        return row;
      });
      return row;
    };

    /** Points the three tables the warm-up writer reads at the given rows. */
    function installWorkout(sets: any[]) {
      const created: any[] = [];
      mockDatabase.get.mockImplementation((table: string) => {
        if (table === 'workout_log_exercises') {
          const bench = { id: 'le-bench', workoutLogId: 'wl-1' };
          const squat = { id: 'le-squat', workoutLogId: 'wl-1' };
          return {
            find: jest.fn().mockResolvedValue(bench),
            query: jest
              .fn()
              .mockReturnValue({ fetch: jest.fn().mockResolvedValue([bench, squat]) }),
          } as any;
        }
        if (table === 'workout_log_sets') {
          return {
            query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue(sets) }),
            prepareCreate: jest.fn((builder: (record: any) => void) => {
              const record: any = {};
              builder(record);
              created.push(record);
              return record;
            }),
          } as any;
        }
        return collection() as any;
      });
      return created;
    }

    it('inserts warm-ups before the first working set and shifts every later set', async () => {
      const first = setRecord({
        id: 'bench-1',
        logExerciseId: 'le-bench',
        setOrder: 1,
        completionStatus: 'planned',
        setType: 'normal',
      });
      const second = setRecord({
        id: 'bench-2',
        logExerciseId: 'le-bench',
        setOrder: 2,
        completionStatus: 'planned',
        setType: 'normal',
      });
      // A DIFFERENT exercise later in the workout: set_order is workout-wide, so it must shift too.
      const squat = setRecord({
        id: 'squat-1',
        logExerciseId: 'le-squat',
        setOrder: 3,
        completionStatus: 'planned',
        setType: 'normal',
      });
      const created = installWorkout([first, second, squat]);

      const added = await WorkoutService.addWarmupSets('le-bench', [
        { weightKg: 40, reps: 5 },
        { weightKg: 60, reps: 3 },
      ]);

      expect(added).toBe(2);
      expect([first.setOrder, second.setOrder, squat.setOrder]).toEqual([3, 4, 5]);
      expect(created.map((set) => set.setOrder)).toEqual([1, 2]);
      expect(created).toEqual([
        expect.objectContaining({
          logExerciseId: 'le-bench',
          weight: 40,
          reps: 5,
          setType: 'warmup',
          completionStatus: 'planned',
        }),
        expect.objectContaining({
          logExerciseId: 'le-bench',
          weight: 60,
          reps: 3,
          setType: 'warmup',
          completionStatus: 'planned',
        }),
      ]);
      // One batch: the session can never be observed with two sets sharing an order.
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    });

    it('anchors on the first set still to be done, leaving finished sets where they are', async () => {
      const done = setRecord({
        id: 'bench-1',
        logExerciseId: 'le-bench',
        setOrder: 1,
        completionStatus: 'performed',
        setType: 'normal',
      });
      const next = setRecord({
        id: 'bench-2',
        logExerciseId: 'le-bench',
        setOrder: 2,
        completionStatus: 'planned',
        setType: 'normal',
      });
      const created = installWorkout([done, next]);

      await WorkoutService.addWarmupSets('le-bench', [{ weightKg: 40, reps: 5 }]);

      expect(done.setOrder).toBe(1);
      expect(next.setOrder).toBe(3);
      expect(created[0].setOrder).toBe(2);
    });

    it('does not stack a second ramp on an exercise that already has warm-ups', async () => {
      const warm = setRecord({
        id: 'w',
        logExerciseId: 'le-bench',
        setOrder: 1,
        completionStatus: 'planned',
        setType: 'warmup',
      });
      const work = setRecord({
        id: 'bench-1',
        logExerciseId: 'le-bench',
        setOrder: 2,
        completionStatus: 'planned',
        setType: 'normal',
      });
      installWorkout([warm, work]);

      expect(await WorkoutService.addWarmupSets('le-bench', [{ weightKg: 40, reps: 5 }])).toBe(0);
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });

    it('adds nothing when no working set is left to warm up for, or nothing is prescribed', async () => {
      const done = setRecord({
        id: 'bench-1',
        logExerciseId: 'le-bench',
        setOrder: 1,
        completionStatus: 'performed',
        setType: 'normal',
      });
      installWorkout([done]);

      expect(await WorkoutService.addWarmupSets('le-bench', [{ weightKg: 40, reps: 5 }])).toBe(0);
      expect(await WorkoutService.addWarmupSets('le-bench', [])).toBe(0);
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });

    it('removes only the warm-ups still to be done', async () => {
      const plannedWarm = setRecord({
        id: 'w1',
        logExerciseId: 'le-bench',
        setOrder: 1,
        completionStatus: 'planned',
        setType: 'warmup',
      });
      const doneWarm = setRecord({
        id: 'w2',
        logExerciseId: 'le-bench',
        setOrder: 2,
        completionStatus: 'performed',
        setType: 'warmup',
      });
      const working = setRecord({
        id: 'bench-1',
        logExerciseId: 'le-bench',
        setOrder: 3,
        completionStatus: 'planned',
        setType: 'normal',
      });
      installWorkout([plannedWarm, doneWarm, working]);

      expect(await WorkoutService.removePlannedWarmupSets('le-bench')).toBe(1);

      expect(plannedWarm.deletedAt).toEqual(expect.any(Number));
      expect(doneWarm.deletedAt).toBeNull();
      expect(working.deletedAt).toBeNull();
    });

    it('does nothing when there are no planned warm-ups to remove', async () => {
      installWorkout([
        setRecord({
          id: 'bench-1',
          logExerciseId: 'le-bench',
          setOrder: 1,
          completionStatus: 'planned',
          setType: 'normal',
        }),
      ]);

      expect(await WorkoutService.removePlannedWarmupSets('le-bench')).toBe(0);
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });
  });

  describe('start-of-workout progression', () => {
    const planned = (id: string, fields: Record<string, unknown> = {}) => {
      const row: any = {
        id,
        logExerciseId: 'le-bench',
        weight: 60,
        reps: 8,
        setOrder: 1,
        completionStatus: 'planned',
        setType: 'normal',
        adjustmentJson: undefined,
        deletedAt: null,
        ...fields,
      };
      row.prepareUpdate = jest.fn((updater: (draft: any) => void) => {
        updater(row);
        return row;
      });
      return row;
    };

    const bench = { id: 'bench', equipmentType: 'barbell', mechanicType: 'compound' };

    /**
     * Installs the tables `applyStartProgression` reads: this workout's log exercises and sets,
     * the exercise catalogue, and the previous session's log exercise + performed sets.
     */
    function installHistory(options: {
      sets: any[];
      previousSets?: any[];
      exercise?: Record<string, unknown>;
    }) {
      const previousLogExercise = { id: 'prev-le' };
      mockDatabase.get.mockImplementation((table: string) => {
        if (table === 'workout_log_exercises') {
          // The same collection is read for this workout and for history; history is the one
          // filtered by `workout_log_id != this workout`, so tell them apart by the clauses.
          return {
            query: jest.fn((...clauses: any[]) => ({
              fetch: jest
                .fn()
                .mockResolvedValue(
                  clauses.some((c) => c?.field === 'exercise_id')
                    ? options.previousSets
                      ? [previousLogExercise]
                      : []
                    : [{ id: 'le-bench', exerciseId: 'bench' }]
                ),
            })),
          } as any;
        }
        if (table === 'workout_log_sets') {
          return {
            query: jest.fn((...clauses: any[]) => ({
              fetch: jest
                .fn()
                .mockResolvedValue(
                  clauses.some((c) => c?.field === 'log_exercise_id' && c.condition === 'prev-le')
                    ? (options.previousSets ?? [])
                    : options.sets
                ),
            })),
          } as any;
        }
        if (table === 'exercises') {
          return {
            query: jest.fn(() => ({
              fetch: jest.fn().mockResolvedValue([{ ...bench, ...options.exercise }]),
            })),
          } as any;
        }
        return collection() as any;
      });
    }

    /** Last session: `weight` kg for 8 reps, the given reps in reserve on every working set. */
    const lastSession = (weight: number, repsInReserve: number) => [
      { weight, reps: 8, repsInReserve, setOrder: 1 },
      { weight, reps: 8, repsInReserve, setOrder: 2 },
    ];

    beforeEach(() => {
      jest.spyOn(SettingsService, 'getWorkoutAutonomy').mockResolvedValue('suggest');
      jest.spyOn(SettingsService, 'getProgressionMode').mockResolvedValue('weight_first');
      jest.spyOn(SettingsService, 'getUnits').mockResolvedValue('metric');
      jest.spyOn(GymService, 'getActiveGym').mockResolvedValue(null);
    });
    afterEach(() => jest.restoreAllMocks());

    it('starts straight sets from how the last session went and records why', async () => {
      const sets = [
        planned('s1', { setOrder: 1 }),
        planned('s2', { setOrder: 2 }),
        planned('s3', { setOrder: 3 }),
      ];
      installHistory({ sets, previousSets: lastSession(62, 4) });

      const changed = await WorkoutService.applyStartProgression('wl-1');

      expect(changed).toBe(3);
      for (const set of sets) {
        expect(set.weight).toBe(65); // 62 + the 2.5 kg step, to a whole kilogram
        expect(set.reps).toBe(8);
        expect(JSON.parse(set.adjustmentJson)).toMatchObject({
          cause: 'progression',
          field: 'weight',
          from: 60,
          to: 65,
          plan: { weightKg: 60, reps: 8 },
          last: { weightKg: 62, reps: 8, averageRepsInReserve: 4 },
        });
      }
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    });

    it('does nothing in manual mode: the plan is copied exactly as it always was', async () => {
      jest.spyOn(SettingsService, 'getWorkoutAutonomy').mockResolvedValue('manual');
      const sets = [planned('s1')];
      installHistory({ sets, previousSets: lastSession(62, 4) });

      expect(await WorkoutService.applyStartProgression('wl-1')).toBe(0);

      expect(sets[0].weight).toBe(60);
      expect(sets[0].adjustmentJson).toBeUndefined();
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });

    it('leaves an exercise with no history exactly as planned', async () => {
      const sets = [planned('s1')];
      installHistory({ sets });

      expect(await WorkoutService.applyStartProgression('wl-1')).toBe(0);

      expect(sets[0]).toMatchObject({ weight: 60, reps: 8 });
    });

    it('does not touch a workout that has already begun, or was already progressed', async () => {
      installHistory({
        sets: [
          planned('done', { completionStatus: 'performed' }),
          planned('next', { setOrder: 2 }),
        ],
        previousSets: lastSession(62, 4),
      });
      expect(await WorkoutService.applyStartProgression('wl-1')).toBe(0);

      mockDatabase.get.mockReset();
      installHistory({
        sets: [planned('s1', { adjustmentJson: '{"cause":"progression"}' })],
        previousSets: lastSession(62, 4),
      });
      expect(await WorkoutService.applyStartProgression('wl-1')).toBe(0);
    });

    it('leaves warm-ups and a pyramid exactly as planned', async () => {
      const warm = planned('warm', { setType: 'warmup', weight: 30, reps: 5, setOrder: 1 });
      const top = planned('top', { weight: 60, reps: 8, setOrder: 2 });
      const backOff = planned('back-off', { weight: 50, reps: 10, setOrder: 3 });
      installHistory({ sets: [warm, top, backOff], previousSets: lastSession(62, 4) });

      await WorkoutService.applyStartProgression('wl-1');

      expect(warm.weight).toBe(30);
      expect(top.weight).toBe(65);
      expect(backOff.weight).toBe(50);
    });

    it('deloads by one step when the last session left nothing in reserve', async () => {
      const sets = [planned('s1')];
      installHistory({ sets, previousSets: lastSession(70, 0) });

      await WorkoutService.applyStartProgression('wl-1');

      expect(sets[0].weight).toBe(68); // 70 − 2.5, to a whole kilogram
      expect(JSON.parse(sets[0].adjustmentJson)).toMatchObject({
        cause: 'deload',
        field: 'weight',
        from: 60,
        to: 68,
        last: { weightKg: 70, averageRepsInReserve: 0 },
      });
    });

    it('repeats last time instead of a stale plan when it was about right', async () => {
      const sets = [planned('s1')];
      installHistory({ sets, previousSets: lastSession(70, 2) });

      await WorkoutService.applyStartProgression('wl-1');

      expect(sets[0].weight).toBe(70);
      expect(JSON.parse(sets[0].adjustmentJson)).toMatchObject({
        cause: 'repeat',
        from: 60,
        to: 70,
      });
    });

    it('leaves a set alone when the target already equals the plan', async () => {
      const sets = [planned('s1', { weight: 70 })];
      installHistory({ sets, previousSets: lastSession(70, 2) });

      expect(await WorkoutService.applyStartProgression('wl-1')).toBe(0);
      expect(sets[0].adjustmentJson).toBeUndefined();
    });

    it('skips cardio and mobility, which have no load and reps to progress', async () => {
      const sets = [planned('s1')];
      installHistory({
        sets,
        previousSets: lastSession(62, 4),
        exercise: { mechanicType: 'cardio' },
      });

      expect(await WorkoutService.applyStartProgression('wl-1')).toBe(0);
    });

    it('surfaces a write failure to its caller, which is why startWorkoutFromTemplate wraps it', async () => {
      const sets = [planned('s1')];
      installHistory({ sets, previousSets: lastSession(62, 4) });
      mockDatabase.write.mockRejectedValueOnce(new Error('db busy'));

      await expect(WorkoutService.applyStartProgression('wl-1')).rejects.toThrow('db busy');
    });

    it('reverts a progression to what the user did last time and clears the explanation', async () => {
      const set = planned('s1', {
        weight: 65,
        adjustmentJson: JSON.stringify({
          cause: 'progression',
          field: 'weight',
          from: 60,
          to: 65,
          plan: { weightKg: 60, reps: 8 },
          last: { weightKg: 62, reps: 7, averageRepsInReserve: 4 },
          now: { weightKg: 65, reps: 8 },
        }),
      });
      installHistory({ sets: [set] });

      expect(await WorkoutService.revertStartAdjustment('le-bench')).toBe(1);

      expect(set).toMatchObject({ weight: 62, reps: 7, adjustmentJson: undefined });
    });

    it('reverts a repeat — which already is last time — to the plan', async () => {
      const set = planned('s1', {
        weight: 62,
        adjustmentJson: JSON.stringify({
          cause: 'repeat',
          field: 'weight',
          from: 60,
          to: 62,
          plan: { weightKg: 60, reps: 8 },
          last: { weightKg: 62, reps: 8, averageRepsInReserve: 2 },
          now: { weightKg: 62, reps: 8 },
        }),
      });
      installHistory({ sets: [set] });

      await WorkoutService.revertStartAdjustment('le-bench');

      expect(set).toMatchObject({ weight: 60, reps: 8 });
    });

    it('ignores sets with no adjustment, a corrupt one, or that are no longer planned', async () => {
      const plain = planned('plain');
      const corrupt = planned('corrupt', { adjustmentJson: 'not json' });
      const done = planned('done', {
        completionStatus: 'performed',
        adjustmentJson: '{"cause":"progression"}',
      });
      installHistory({ sets: [plain, corrupt, done] });

      expect(await WorkoutService.revertStartAdjustment('le-bench')).toBe(0);
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });

    it('starting a workout still succeeds when progression fails', async () => {
      const mockTemplate = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: null,
        startWorkout: jest.fn().mockResolvedValue(createMockWorkoutLog({ id: 'wl-1' })),
      });
      mockDatabase.get.mockReturnValue(
        collection({ find: jest.fn().mockResolvedValue(mockTemplate) }) as any
      );
      jest.spyOn(WorkoutService, 'applyStartProgression').mockRejectedValue(new Error('boom'));

      await expect(WorkoutService.startWorkoutFromTemplate('template-1')).resolves.toBeDefined();
    });
  });
});
