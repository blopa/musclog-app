import { database } from '../../index';
import { WorkoutAnalytics } from '../WorkoutAnalytics';
import { WorkoutService } from '../WorkoutService';
import {
  createMockExercise,
  createMockSchedule,
  createMockWorkoutLog,
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

jest.mock('../../index', () => {
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

const mockDatabase = database as jest.Mocked<typeof database>;
const mockWorkoutAnalytics = WorkoutAnalytics as jest.Mocked<typeof WorkoutAnalytics>;

describe('WorkoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startWorkoutFromTemplate', () => {
    it('should create workout from template successfully', async () => {
      const mockTemplate = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: null,
        startWorkout: jest.fn().mockResolvedValue(createMockWorkoutLog()),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(mockTemplate),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any);

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

      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValue(mockTemplate),
      } as any);

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
        completedAt: null,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([activeWorkout]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(mockTemplate),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any);

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

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(mockTemplate),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any);

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

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(mockTemplate),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any);

      await expect(WorkoutService.startWorkoutFromTemplate('template-1')).rejects.toThrow(
        'Failed to start workout: Unknown error'
      );
    });

    it('should handle non-Error type exceptions from find', async () => {
      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockRejectedValue('String error from find'),
      } as any);

      await expect(WorkoutService.startWorkoutFromTemplate('template-1')).rejects.toThrow(
        'Failed to start workout: Unknown error'
      );
    });

    it('should handle non-Error type exceptions from getActiveWorkout', async () => {
      const mockTemplate = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: null,
      });

      const mockQuery = {
        fetch: jest.fn().mockRejectedValue('String error from getActiveWorkout'),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(mockTemplate),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any);

      await expect(WorkoutService.startWorkoutFromTemplate('template-1')).rejects.toThrow(
        'Failed to start workout: Unknown error'
      );
    });
  });

  describe('getActiveWorkout', () => {
    it('should return active workout when exists', async () => {
      const activeWorkout = createMockWorkoutLog({
        completedAt: null,
        deletedAt: null,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([activeWorkout]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getActiveWorkout();

      expect(result).toBe(activeWorkout);
      expect(mockDatabase.get).toHaveBeenCalledWith('workout_logs');
    });

    it('should return null when no active workout', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getActiveWorkout();

      expect(result).toBeNull();
    });

    it('should return most recent if multiple active', async () => {
      const olderWorkout = createMockWorkoutLog({
        id: 'workout-1',
        completedAt: null,
        startedAt: Date.now() - 1000,
      });

      const newerWorkout = createMockWorkoutLog({
        id: 'workout-2',
        completedAt: null,
        startedAt: Date.now(),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([newerWorkout, olderWorkout]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutService.getActiveWorkout();

      expect(result).toBe(newerWorkout);
    });

    it('should filter out completed and deleted workouts', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

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

      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValueOnce(workoutLog).mockResolvedValueOnce(completedWorkout),
      } as any);

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

      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValue(workoutLog),
      } as any);

      await expect(WorkoutService.completeWorkout('workout-1')).rejects.toThrow(
        'Workout is already completed'
      );
    });

    it('should handle workout not found error', async () => {
      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockRejectedValue(new Error('Workout not found')),
      } as any);

      await expect(WorkoutService.completeWorkout('workout-1')).rejects.toThrow(
        'Failed to complete workout'
      );
    });

    it('should handle non-Error type exceptions', async () => {
      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockRejectedValue('String error'),
      } as any);

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

      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValue(workoutLog),
      } as any);

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

      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValueOnce(workoutLog).mockResolvedValueOnce(completedWorkout),
      } as any);

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

      const set1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        setOrder: 1,
      });

      const set2 = createMockWorkoutLogSet({
        exerciseId: 'ex-2',
        setOrder: 2,
      });

      const exercise1 = createMockExercise({ id: 'ex-1' });
      const exercise2 = createMockExercise({ id: 'ex-2' });

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([set1, set2])
          .mockResolvedValueOnce([exercise1, exercise2]),
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
          query: jest.fn().mockReturnValue(mockQuery),
        } as any);

      const result = await WorkoutService.getWorkoutWithDetails('workout-1');

      expect(result.workoutLog).toBe(workoutLog);
      expect(result.sets).toEqual([set1, set2]);
      expect(result.exercises).toEqual([exercise1, exercise2]);
    });

    it('should get sets ordered by set_order asc', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        deletedAt: null,
      });

      const set1 = createMockWorkoutLogSet({ setOrder: 1 });
      const set2 = createMockWorkoutLogSet({ setOrder: 2 });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([set1, set2]),
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

      expect(result.sets).toEqual([set1, set2]);
    });

    it('should get unique exercises for sets', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        deletedAt: null,
      });

      const set1 = createMockWorkoutLogSet({ exerciseId: 'ex-1' });
      const set2 = createMockWorkoutLogSet({ exerciseId: 'ex-1' });
      const set3 = createMockWorkoutLogSet({ exerciseId: 'ex-2' });

      const exercise1 = createMockExercise({ id: 'ex-1' });
      const exercise2 = createMockExercise({ id: 'ex-2' });

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([set1, set2, set3])
          .mockResolvedValueOnce([exercise1, exercise2]),
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
          query: jest.fn().mockReturnValue(mockQuery),
        } as any);

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
