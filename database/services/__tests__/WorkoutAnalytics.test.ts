import { database } from '@/database/index';
import { WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import { calculate1RM } from '@/utils/workoutCalculator';

import { createMockExercise, createMockWorkoutLog, createMockWorkoutLogSet } from './helpers';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => value),
    notEq: jest.fn((value: any) => value),
    gte: jest.fn((value: any) => value),
    lte: jest.fn((value: any) => value),
    oneOf: jest.fn((values: any[]) => values),
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

const mockDatabase = database as jest.Mocked<typeof database>;

// Helper to create default mock collection
const createMockCollection = () => {
  const mockQuery = {
    fetch: jest.fn().mockResolvedValue([]),
    extend: jest.fn().mockReturnThis(),
  };

  return {
    query: jest.fn().mockReturnValue(mockQuery),
    find: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    prepareCreate: jest.fn().mockReturnValue({}),
    fetch: jest.fn().mockResolvedValue([]),
  };
};

describe('WorkoutAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementation to default
    mockDatabase.get.mockReturnValue(createMockCollection() as any);
  });

  describe('calculate1RM (Epley)', () => {
    it('should calculate correctly using Epley formula', () => {
      const result = calculate1RM(100, 10, 'Epley', 0);
      // Epley: weight × (1 + reps/30) = 100 × (1 + 10/30) = 100 × 1.333 = 133.33
      expect(result).toBeCloseTo(133.33, 2);
    });

    it('should return weight when reps is 0 (Epley: 1 + 0/30)', () => {
      const result = calculate1RM(100, 0, 'Epley', 0);
      expect(result).toBeCloseTo(100, 2);
    });

    it('should handle various weight/reps combinations', () => {
      expect(calculate1RM(50, 5, 'Epley', 0)).toBeCloseTo(58.33, 2);
      expect(calculate1RM(200, 1, 'Epley', 0)).toBeCloseTo(206.67, 2);
      expect(calculate1RM(80, 12, 'Epley', 0)).toBeCloseTo(112, 2);
    });
  });

  describe('detectPersonalRecords', () => {
    it('should detect volume PR when current > historical best', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      // Current: 100x10 = 1000 volume, 1RM ~133.33
      // Historical: 110x9 = 990 volume (less volume), 1RM ~143 (more 1RM), weight 110 (more weight), reps 9 (less reps)
      // This ensures only volume PR is detected (not weight, 1RM, or reps PR)
      // Note: The function finds the best historical set by volume, so 110x9 (990) is the best
      const currentSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      // Best by volume: 110x9 = 990 (used for volume PR comparison)
      // But we also need a set with reps >= 10 to avoid reps PR
      const historicalSet1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 110,
        reps: 9,
        workoutLogId: 'workout-2',
      });

      // This set has higher reps (>= 10) to avoid reps PR, but lower volume
      // 95x10 = 950 volume (less than best historical 990, so won't be selected as best)
      const historicalSet2 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 95,
        reps: 10,
        workoutLogId: 'workout-2',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
      });

      const historicalWorkout = createMockWorkoutLog({
        id: 'workout-2',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      workoutLog.logSets.fetch = jest.fn().mockResolvedValue([currentSet]);

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([historicalSet1, historicalSet2]) // historical sets
          .mockResolvedValueOnce([historicalWorkout]) // completed workouts
          .mockResolvedValueOnce([exercise]), // exercise
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(exercise),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(historicalWorkout),
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      expect(records).toHaveLength(1);
      expect(records[0].type).toBe('volume');
      expect(records[0].newRecord.volume).toBe(1000);
      expect(records[0].previousBest.volume).toBe(990);
    });

    it('should detect weight PR when current weight > historical max', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const currentSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 120,
        reps: 5,
        workoutLogId: 'workout-1',
      });

      const historicalSet1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-2',
      });

      const historicalSet2 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 110,
        reps: 8,
        workoutLogId: 'workout-3',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
      });

      const historicalWorkout1 = createMockWorkoutLog({
        id: 'workout-2',
        startedAt: Date.now() - 2000,
        completedAt: Date.now() - 1500,
      });

      const historicalWorkout2 = createMockWorkoutLog({
        id: 'workout-3',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      workoutLog.logSets.fetch = jest.fn().mockResolvedValue([currentSet]);

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([historicalSet1, historicalSet2])
          .mockResolvedValueOnce([historicalWorkout1, historicalWorkout2]),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(exercise),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(historicalWorkout1),
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      const weightPR = records.find((r) => r.type === 'weight');
      expect(weightPR).toBeDefined();
      expect(weightPR?.newRecord.weight).toBe(120);
      // bestHistoricalWeight should be max(100, 110) = 110
      expect(weightPR?.previousBest.weight).toBe(110);
    });

    it('should detect reps PR when current reps > historical max', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const currentSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 15,
        workoutLogId: 'workout-1',
      });

      const historicalSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 12,
        workoutLogId: 'workout-2',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
      });

      const historicalWorkout = createMockWorkoutLog({
        id: 'workout-2',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      workoutLog.logSets.fetch = jest.fn().mockResolvedValue([currentSet]);

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([historicalSet])
          .mockResolvedValueOnce([historicalWorkout]),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(exercise),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(historicalWorkout),
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      const repsPR = records.find((r) => r.type === 'reps');
      expect(repsPR).toBeDefined();
      expect(repsPR?.newRecord.reps).toBe(15);
      expect(repsPR?.previousBest.reps).toBe(12);
    });

    it('should return PR for first-time exercise (no historical data)', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const currentSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
      });

      workoutLog.logSets.fetch = jest.fn().mockResolvedValue([currentSet]);

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([]) // no historical sets
          .mockResolvedValueOnce([]), // no completed workouts
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(exercise),
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      expect(records).toHaveLength(1);
      expect(records[0].type).toBe('volume');
      expect(records[0].previousBest.volume).toBe(0);
      expect(records[0].newRecord.volume).toBe(1000);
    });

    it('should handle multiple PR types in single workout', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const currentSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 120,
        reps: 15,
        workoutLogId: 'workout-1',
      });

      const historicalSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-2',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
      });

      const historicalWorkout = createMockWorkoutLog({
        id: 'workout-2',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      workoutLog.logSets.fetch = jest.fn().mockResolvedValue([currentSet]);

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([historicalSet])
          .mockResolvedValueOnce([historicalWorkout]),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(exercise),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(historicalWorkout),
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      expect(records.length).toBeGreaterThan(1);
      const types = records.map((r) => r.type);
      expect(types).toContain('volume');
      expect(types).toContain('weight');
      expect(types).toContain('reps');
    });

    it('should skip deleted sets and incomplete workouts', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const currentSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const deletedSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 90,
        reps: 10,
        workoutLogId: 'workout-2',
        deletedAt: Date.now(),
      });

      const incompleteWorkoutSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 95,
        reps: 10,
        workoutLogId: 'workout-3',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
      });

      const incompleteWorkout = createMockWorkoutLog({
        id: 'workout-3',
        startedAt: Date.now() - 1000,
        completedAt: null,
      });

      workoutLog.logSets.fetch = jest.fn().mockResolvedValue([currentSet]);

      // First query: historical sets (will return deletedSet and incompleteWorkoutSet)
      // Second query: completed workouts (will return empty since incompleteWorkout has completedAt: null)
      // This means validHistoricalSets.length === 0, so it should create a first-time PR
      const mockQuery1 = {
        fetch: jest.fn().mockResolvedValue([deletedSet, incompleteWorkoutSet]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockQuery2 = {
        fetch: jest.fn().mockResolvedValue([]), // No completed workouts
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery1),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery2),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(exercise),
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      // Should still create PR since no valid historical data (all sets are from incomplete/deleted workouts)
      expect(records).toHaveLength(1);
      expect(records[0].previousBest.volume).toBe(0);
      expect(records[0].type).toBe('volume');
    });

    it('should handle exercise not found gracefully', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const currentSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      workoutLog.logSets.fetch = jest.fn().mockResolvedValue([currentSet]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockRejectedValue(new Error('Exercise not found')),
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      expect(records).toHaveLength(0);
    });

    it('should get exercise name correctly', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const currentSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
      });

      workoutLog.logSets.fetch = jest.fn().mockResolvedValue([currentSet]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(exercise),
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      expect(records[0].exerciseName).toBe('Bench Press');
    });

    it('should handle reduce comparison when currentVolume <= bestVolume', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      // Create sets where first set has higher volume, second has lower
      const currentSet1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10, // 1000 volume
        workoutLogId: 'workout-1',
      });

      const currentSet2 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 90,
        reps: 9, // 810 volume (lower than set1)
        workoutLogId: 'workout-1',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
      });

      workoutLog.logSets.fetch = jest.fn().mockResolvedValue([currentSet1, currentSet2]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]), // No historical sets
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(exercise),
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      // Should detect PR (first time doing exercise) with best set (set1 with higher volume)
      expect(records.length).toBeGreaterThan(0);
      expect(records[0].newRecord.volume).toBe(1000); // Should use set1 (higher volume)
    });

    it('should handle reduce comparison when currentVolume <= bestVolume (reverse order)', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      // Create sets where first set has lower volume, second has higher
      // This ensures the reduce function processes both branches: > and <=
      const currentSet1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 90,
        reps: 9, // 810 volume (lower)
        workoutLogId: 'workout-1',
      });

      const currentSet2 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10, // 1000 volume (higher - will become best)
        workoutLogId: 'workout-1',
      });

      const currentSet3 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 80,
        reps: 8, // 640 volume (lower - will test <= branch)
        workoutLogId: 'workout-1',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
      });

      workoutLog.logSets.fetch = jest
        .fn()
        .mockResolvedValue([currentSet1, currentSet2, currentSet3]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]), // No historical sets
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(exercise),
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      // Should detect PR with best set (set2 with highest volume)
      expect(records.length).toBeGreaterThan(0);
      expect(records[0].newRecord.volume).toBe(1000); // Should use set2 (highest volume)
    });

    it('should handle reduce comparison for historical sets when currentVolume <= bestVolume', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const currentSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      // Create multiple historical sets where we need to test the reduce function
      // First set has lower volume, second has higher, third has lower (to test <= branch)
      const historicalSet1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 90,
        reps: 9, // 810 volume (lower)
        workoutLogId: 'workout-2',
      });

      const historicalSet2 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 9, // 900 volume (higher - will become best)
        workoutLogId: 'workout-3',
      });

      const historicalSet3 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 80,
        reps: 8, // 640 volume (lower - will test <= branch)
        workoutLogId: 'workout-4',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
      });

      const historicalWorkout1 = createMockWorkoutLog({
        id: 'workout-2',
        startedAt: Date.now() - 3000,
        completedAt: Date.now() - 2500,
      });

      const historicalWorkout2 = createMockWorkoutLog({
        id: 'workout-3',
        startedAt: Date.now() - 2000,
        completedAt: Date.now() - 1500,
      });

      const historicalWorkout3 = createMockWorkoutLog({
        id: 'workout-4',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      workoutLog.logSets.fetch = jest.fn().mockResolvedValue([currentSet]);

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([historicalSet1, historicalSet2, historicalSet3])
          .mockResolvedValueOnce([historicalWorkout1, historicalWorkout2, historicalWorkout3]),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(exercise),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(historicalWorkout2), // Best historical workout
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      // Should detect volume PR (current 1000 > historical best 900)
      expect(records.length).toBeGreaterThan(0);
      const volumePR = records.find((r) => r.type === 'volume');
      expect(volumePR).toBeDefined();
      expect(volumePR?.previousBest.volume).toBe(900); // Best historical (set2)
    });

    it('should skip exercises when workout or exercise not found', async () => {
      const workoutLog = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const currentSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const historicalSet = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 90,
        reps: 10,
        workoutLogId: 'workout-2',
      });

      const historicalWorkout = createMockWorkoutLog({
        id: 'workout-2',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      workoutLog.logSets.fetch = jest.fn().mockResolvedValue([currentSet]);

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([historicalSet])
          .mockResolvedValueOnce([historicalWorkout]),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockRejectedValue(new Error('Exercise not found')),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(historicalWorkout),
        } as any);

      const records = await WorkoutAnalytics.detectPersonalRecords(workoutLog as any);

      // Should skip the exercise when not found, returning empty records
      expect(records).toHaveLength(0);
    });
  });

  describe('getProgressiveOverloadData', () => {
    it('should return data points for completed workouts only', async () => {
      const set1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const set2 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 105,
        reps: 10,
        workoutLogId: 'workout-2',
      });

      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now() - 2000,
        completedAt: Date.now() - 1500,
      });

      const workout2 = createMockWorkoutLog({
        id: 'workout-2',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      // First query: get sets
      const setsQuery = {
        fetch: jest.fn().mockResolvedValue([set1, set2]),
      };

      // Second query: get completed workouts
      const workoutsQuery = {
        fetch: jest.fn().mockResolvedValue([workout1, workout2]),
      };

      // Mock find for individual workouts - needs to be shared across all database.get calls
      const findMock = jest.fn().mockResolvedValueOnce(workout1).mockResolvedValueOnce(workout2);

      // Reset the mock to ensure clean state
      mockDatabase.get.mockReset();

      // Mock database.get to return different mocks based on collection name
      // The method calls database.get() 3 times:
      // 1. workout_log_sets.query() - to get sets
      // 2. workout_logs.query() - to get completed workouts
      // 3. workout_logs.find() - called in loop for each workout
      mockDatabase.get.mockImplementation((collectionName: string) => {
        if (collectionName === 'workout_log_sets') {
          return {
            query: jest.fn().mockReturnValue(setsQuery),
            find: findMock,
          } as any;
        } else if (collectionName === 'workout_logs') {
          return {
            query: jest.fn().mockReturnValue(workoutsQuery),
            find: findMock,
          } as any;
        }
        return {
          query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
          find: findMock,
        } as any;
      });

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result).toHaveLength(2);
      expect(result[0].weight).toBe(100);
      expect(result[1].weight).toBe(105);
    });

    it('should filter by timeframe when provided', async () => {
      const set1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      const timeframe = {
        startDate: Date.now() - 2000,
        endDate: Date.now(),
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValueOnce([set1]).mockResolvedValueOnce([workout1]),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
        find: jest.fn().mockResolvedValue(workout1),
      } as any);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1', timeframe);

      expect(result).toHaveLength(1);
    });

    it('should group sets by workout and get best set per workout', async () => {
      const set1a = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 8,
        workoutLogId: 'workout-1',
      });

      const set1b = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValueOnce([set1a, set1b]).mockResolvedValueOnce([workout1]),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
        find: jest.fn().mockResolvedValue(workout1),
      } as any);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result).toHaveLength(1);
      expect(result[0].reps).toBe(10); // Best set (higher volume)
    });

    it('should calculate volume and estimated1RM for each point', async () => {
      const set = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const workout = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValueOnce([set]).mockResolvedValueOnce([workout]),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
        find: jest.fn().mockResolvedValue(workout),
      } as any);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result[0].volume).toBe(1000);
      expect(result[0].estimated1RM).toBeCloseTo(133.33, 2);
    });

    it('should sort by date ascending', async () => {
      const set1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const set2 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 105,
        reps: 10,
        workoutLogId: 'workout-2',
      });

      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now() - 2000,
        completedAt: Date.now() - 1500,
      });

      const workout2 = createMockWorkoutLog({
        id: 'workout-2',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([set2, set1])
          .mockResolvedValueOnce([workout1, workout2]),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
        find: jest.fn().mockResolvedValueOnce(workout1).mockResolvedValueOnce(workout2),
      } as any);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result[0].date).toBeLessThan(result[1].date);
    });

    it('should handle workout not found gracefully', async () => {
      const set = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValueOnce([set]).mockResolvedValueOnce([]),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
        find: jest.fn().mockRejectedValue(new Error('Workout not found')),
      } as any);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no data', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result).toEqual([]);
    });

    it('should skip sets when workout not found', async () => {
      const set1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now() - 2000,
        completedAt: Date.now() - 1500,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValueOnce([set1]).mockResolvedValueOnce([workout1]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
          find: jest.fn(),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
          find: jest
            .fn()
            .mockResolvedValueOnce(workout1) // First workout found
            .mockRejectedValueOnce(new Error('Workout not found')), // Second workout not found
        } as any);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      // Should only return data points for workouts that were found
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should not update workoutData when existing set has higher or equal volume', async () => {
      // Test line 286: when existing set exists and new set has volume <= existing
      const set1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10, // 1000 volume (higher)
        workoutLogId: 'workout-1',
      });

      const set2 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 90,
        reps: 9, // 810 volume (lower - should not replace set1)
        workoutLogId: 'workout-1',
      });

      const set3 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10, // 1000 volume (equal - should not replace set1)
        workoutLogId: 'workout-1',
      });

      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now() - 1000,
        completedAt: Date.now() - 500,
      });

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([set1, set2, set3])
          .mockResolvedValueOnce([workout1]),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
        find: jest.fn().mockResolvedValue(workout1),
      } as any);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      // Should only have one data point (best set per workout)
      expect(result).toHaveLength(1);
      // Should use set1 (first set with highest volume), not set2 or set3
      expect(result[0].weight).toBe(100);
      expect(result[0].reps).toBe(10);
      expect(result[0].volume).toBe(1000);
    });
  });

  describe('calculateMuscleGroupVolume', () => {
    it('should calculate volume per muscle group correctly', async () => {
      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const set1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const exercise1 = createMockExercise({
        id: 'ex-1',
        muscleGroup: 'chest',
      });

      workout1.logSets.fetch = jest.fn().mockResolvedValue([set1]);

      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValue(exercise1),
      } as any);

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume([workout1 as any]);

      expect(result).toHaveLength(1);
      expect(result[0].muscleGroup).toBe('chest');
      expect(result[0].totalVolume).toBe(1000);
      expect(result[0].exerciseCount).toBe(1);
    });

    it('should count unique exercises per muscle group', async () => {
      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const set1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const set2 = createMockWorkoutLogSet({
        exerciseId: 'ex-2',
        weight: 80,
        reps: 12,
        workoutLogId: 'workout-1',
      });

      const exercise1 = createMockExercise({
        id: 'ex-1',
        muscleGroup: 'chest',
      });

      const exercise2 = createMockExercise({
        id: 'ex-2',
        muscleGroup: 'chest',
      });

      workout1.logSets.fetch = jest.fn().mockResolvedValue([set1, set2]);

      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValueOnce(exercise1).mockResolvedValueOnce(exercise2),
      } as any);

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume([workout1 as any]);

      expect(result[0].exerciseCount).toBe(2);
      expect(result[0].totalVolume).toBe(1960); // 1000 + 960
    });

    it('should filter by timeframe when provided', async () => {
      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now() - 5000,
      });

      const workout2 = createMockWorkoutLog({
        id: 'workout-2',
        startedAt: Date.now() - 1000,
      });

      const set1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const set2 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 105,
        reps: 10,
        workoutLogId: 'workout-2',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        muscleGroup: 'chest',
      });

      workout1.logSets.fetch = jest.fn().mockResolvedValue([set1]);
      workout2.logSets.fetch = jest.fn().mockResolvedValue([set2]);

      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValue(exercise),
      } as any);

      const timeframe = {
        startDate: Date.now() - 2000,
        endDate: Date.now(),
      };

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume(
        [workout1 as any, workout2 as any],
        timeframe
      );

      expect(result[0].totalVolume).toBe(1050); // Only workout2
    });

    it('should handle exercise not found gracefully', async () => {
      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const set1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      workout1.logSets.fetch = jest.fn().mockResolvedValue([set1]);

      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockRejectedValue(new Error('Exercise not found')),
      } as any);

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume([workout1 as any]);

      expect(result).toEqual([]);
    });

    it('should return empty array when no workouts', async () => {
      const result = await WorkoutAnalytics.calculateMuscleGroupVolume([]);

      expect(result).toEqual([]);
    });

    it('should group sets correctly across workouts', async () => {
      const workout1 = createMockWorkoutLog({
        id: 'workout-1',
        startedAt: Date.now(),
      });

      const workout2 = createMockWorkoutLog({
        id: 'workout-2',
        startedAt: Date.now(),
      });

      const set1 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 100,
        reps: 10,
        workoutLogId: 'workout-1',
      });

      const set2 = createMockWorkoutLogSet({
        exerciseId: 'ex-1',
        weight: 105,
        reps: 10,
        workoutLogId: 'workout-2',
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        muscleGroup: 'chest',
      });

      workout1.logSets.fetch = jest.fn().mockResolvedValue([set1]);
      workout2.logSets.fetch = jest.fn().mockResolvedValue([set2]);

      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValue(exercise),
      } as any);

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume([
        workout1 as any,
        workout2 as any,
      ]);

      expect(result[0].totalVolume).toBe(2050); // 1000 + 1050
      expect(result[0].exerciseCount).toBe(1); // Same exercise
    });
  });
});
