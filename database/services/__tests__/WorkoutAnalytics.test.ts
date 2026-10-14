import './workoutAnalyticsMocks';

import { database } from '@/database/database-instance';
import { WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import {
  calculate1RM,
  calculateEstimated1RMForSet,
  calculateSetVolume,
} from '@/utils/workoutCalculator';
import { createMockExercise } from './helpers';
import {
  mockDatabase,
  BODY_WEIGHT_KG,
  vol,
  SetSpec,
  WorkoutSpec,
  Row,
  row,
  buildFixture,
  matchesClause,
  queryFixture,
  installFixture,
} from './workoutAnalyticsFixture';

describe('WorkoutAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installFixture({});
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
    const benchPress = createMockExercise({ id: 'ex-1', name: 'Bench Press' });

    it('should detect volume PR when current > historical best', async () => {
      // Volume is an average-1RM estimate, so the numbers are chosen against that scale:
      // current 120x8 (146.92) beats the best historical set 125x5 (142.53), while the
      // history still holds the heaviest single set (125 > 120) and the most reps
      // (9 > 8) — so a volume PR is the only one that should fire.
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 120, reps: 8 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 125, reps: 5 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 110, reps: 9 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() },
          { id: 'workout-2', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records).toHaveLength(1);
      expect(records[0].type).toBe('volume');
      expect(records[0].newRecord.volume).toBe(vol(120, 8));
      expect(records[0].previousBest.volume).toBe(vol(125, 5));
    });

    it('should detect weight PR when current weight > historical max', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 120, reps: 5 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 100, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-3', weight: 110, reps: 8 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() },
          { id: 'workout-2', startedAt: Date.now() - 2000, completedAt: Date.now() - 1500 },
          { id: 'workout-3', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      const weightPR = records.find((r) => r.type === 'weight');
      expect(weightPR).toBeDefined();
      expect(weightPR?.newRecord.weight).toBe(120);
      // bestHistoricalWeight should be max(100, 110) = 110
      expect(weightPR?.previousBest.weight).toBe(110);
    });

    it('should detect reps PR when current reps > historical max', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 15 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 100, reps: 12 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() },
          { id: 'workout-2', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      const repsPR = records.find((r) => r.type === 'reps');
      expect(repsPR).toBeDefined();
      expect(repsPR?.newRecord.reps).toBe(15);
      expect(repsPR?.previousBest.reps).toBe(12);
    });

    it('should return PR for first-time exercise (no historical data)', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [{ exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 }],
        workouts: [{ id: 'workout-1', startedAt: Date.now() }],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records).toHaveLength(1);
      expect(records[0].type).toBe('volume');
      expect(records[0].previousBest.volume).toBe(0);
      expect(records[0].newRecord.volume).toBe(vol(100, 10));
    });

    it('should handle multiple PR types in single workout', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 120, reps: 15 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 100, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() },
          { id: 'workout-2', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records.length).toBeGreaterThan(1);
      const types = records.map((r) => r.type);
      expect(types).toContain('volume');
      expect(types).toContain('weight');
      expect(types).toContain('reps');
    });

    it('should skip deleted sets and incomplete workouts', async () => {
      // workout-2's set is soft-deleted and workout-3 was never completed, so there is no
      // valid history and the current set should register as a first-time PR.
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { deleted: true, exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 90, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-3', weight: 95, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() },
          { id: 'workout-2', startedAt: Date.now() - 2000, completedAt: Date.now() - 1500 },
          { completedAt: null, id: 'workout-3', startedAt: Date.now() - 1000 },
        ],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records).toHaveLength(1);
      expect(records[0].previousBest.volume).toBe(0);
      expect(records[0].type).toBe('volume');
    });

    it('should handle exercise not found gracefully', async () => {
      const fixture = buildFixture({
        // No `exercises` row, so `database.get('exercises').find()` rejects.
        sets: [{ exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 }],
        workouts: [{ id: 'workout-1', startedAt: Date.now() }],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records).toHaveLength(0);
    });

    it('should get exercise name correctly', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [{ exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 }],
        workouts: [{ id: 'workout-1', startedAt: Date.now() }],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records[0].exerciseName).toBe('Bench Press');
    });

    it('should handle reduce comparison when currentVolume <= bestVolume', async () => {
      // First set has the higher volume, so the reduce must keep it.
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 90, reps: 9 },
        ],
        workouts: [{ id: 'workout-1', startedAt: Date.now() }],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records.length).toBeGreaterThan(0);
      expect(records[0].newRecord.volume).toBe(vol(100, 10));
    });

    it('should handle reduce comparison when currentVolume <= bestVolume (reverse order)', async () => {
      // Lower, then higher, then lower again — exercises both reduce branches.
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 90, reps: 9 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 80, reps: 8 },
        ],
        workouts: [{ id: 'workout-1', startedAt: Date.now() }],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records.length).toBeGreaterThan(0);
      expect(records[0].newRecord.volume).toBe(vol(100, 10));
    });

    it('should handle reduce comparison for historical sets when currentVolume <= bestVolume', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 90, reps: 9 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-3', weight: 100, reps: 9 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-4', weight: 80, reps: 8 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() },
          { id: 'workout-2', startedAt: Date.now() - 3000, completedAt: Date.now() - 2500 },
          { id: 'workout-3', startedAt: Date.now() - 2000, completedAt: Date.now() - 1500 },
          { id: 'workout-4', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records.length).toBeGreaterThan(0);
      const volumePR = records.find((r) => r.type === 'volume');
      expect(volumePR).toBeDefined();
      // Best historical set is 100x9.
      expect(volumePR?.previousBest.volume).toBe(vol(100, 9));
    });

    it('should skip exercises when workout or exercise not found', async () => {
      const fixture = buildFixture({
        // Again no `exercises` row: the exercise lookup rejects and the exercise is skipped.
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 90, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() },
          { id: 'workout-2', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records).toHaveLength(0);
    });
  });

  describe('warm-up sets', () => {
    const benchPress = createMockExercise({ id: 'ex-1', name: 'Bench Press' });

    it('does not let a heavy-looking warm-up produce a personal record', async () => {
      // A warm-up single at a weight above anything the user has ever worked with would, if
      // counted, be flagged as a weight PR. It is not a working set, so it must be invisible.
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          {
            exerciseId: 'ex-1',
            workoutLogId: 'workout-1',
            weight: 140,
            reps: 1,
            setType: 'warmup',
          },
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 5 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 110, reps: 5 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() },
          { id: 'workout-2', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records.find((r) => r.type === 'weight')).toBeUndefined();
    });

    it('still detects a real PR when the same session also contains warm-ups', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 40, reps: 8, setType: 'warmup' },
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 120, reps: 5 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 100, reps: 5 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() },
          { id: 'workout-2', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const records = await WorkoutAnalytics.detectPersonalRecords(fixture.workout_logs[0] as any);

      expect(records.find((r) => r.type === 'weight')?.newRecord.weight).toBe(120);
    });

    it("keeps a warm-up out of an exercise's estimated 1RM trend", async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          {
            exerciseId: 'ex-1',
            workoutLogId: 'workout-1',
            weight: 200,
            reps: 1,
            setType: 'warmup',
          },
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result).toHaveLength(1);
      expect(result[0].weight).toBe(100);
    });

    it('does not count a session that only warmed up as a session the exercise was trained', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 40, reps: 8, setType: 'warmup' },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const frequency = await WorkoutAnalytics.getAverageFrequencyPerWeek('ex-1');

      expect(frequency.value).toBe(0);
    });
  });

  describe('getProgressiveOverloadData', () => {
    const benchPress = createMockExercise({ id: 'ex-1', name: 'Bench Press' });

    it('should return data points for completed workouts only', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 105, reps: 10 },
          // workout-3 was never completed, so its set must not produce a data point.
          { exerciseId: 'ex-1', workoutLogId: 'workout-3', weight: 200, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 2000, completedAt: Date.now() - 1500 },
          { id: 'workout-2', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
          { completedAt: null, id: 'workout-3', startedAt: Date.now() - 100 },
        ],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result).toHaveLength(2);
      expect(result[0].weight).toBe(100);
      expect(result[1].weight).toBe(105);
    });

    it('should filter by timeframe when provided', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          // Outside the timeframe below.
          { exerciseId: 'ex-1', workoutLogId: 'workout-0', weight: 80, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
          { id: 'workout-0', startedAt: Date.now() - 10_000, completedAt: Date.now() - 9500 },
        ],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1', {
        endDate: Date.now(),
        startDate: Date.now() - 2000,
      });

      expect(result).toHaveLength(1);
      expect(result[0].weight).toBe(100);
    });

    it('should group sets by workout and get best set per workout', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 8 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result).toHaveLength(1);
      expect(result[0].reps).toBe(10); // Best set (higher volume)
    });

    it('should calculate volume and estimated1RM for each point', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [{ exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 }],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result[0].volume).toBe(vol(100, 10));
      expect(result[0].estimated1RM).toBeCloseTo(
        calculateEstimated1RMForSet(100, 10, 0, 'barbell', BODY_WEIGHT_KG),
        5
      );
    });

    it('excludes skipped template sets from progress calculations', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 8 },
          {
            exerciseId: 'ex-1',
            workoutLogId: 'workout-1',
            weight: 200,
            reps: 10,
            difficultyLevel: 0,
            completionStatus: 'skipped',
          },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ weight: 100, reps: 8 });
    });

    it('should sort by date ascending', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          // Declared newest-first so the sort has something to do.
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 105, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 2000, completedAt: Date.now() - 1500 },
          { id: 'workout-2', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result[0].date).toBeLessThan(result[1].date);
    });

    it('should handle workout not found gracefully', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [{ exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 }],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      // Drop the workout row after the completed-workout filter has been satisfied by
      // making `find` reject for it.
      installFixture(fixture);
      const baseGet = mockDatabase.get.getMockImplementation()!;
      mockDatabase.get.mockImplementation((table: string) => {
        const collection = baseGet(table);
        if (table === 'workout_logs') {
          return {
            ...collection,
            find: jest.fn().mockRejectedValue(new Error('Workout not found')),
          } as any;
        }
        return collection;
      });

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no data', async () => {
      installFixture(buildFixture({}));

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result).toEqual([]);
    });

    it('should skip sets when workout not found', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 105, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 2000, completedAt: Date.now() - 1500 },
          { id: 'workout-2', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);
      const baseGet = mockDatabase.get.getMockImplementation()!;
      mockDatabase.get.mockImplementation((table: string) => {
        const collection = baseGet(table);
        if (table === 'workout_logs') {
          return {
            ...collection,
            find: jest.fn(async (id: string) => {
              if (id === 'workout-2') {
                throw new Error('Workout not found');
              }
              return fixture.workout_logs.find((w) => w.id === id);
            }),
          } as any;
        }
        return collection;
      });

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      // Only the workout that could be resolved yields a data point.
      expect(result).toHaveLength(1);
      expect(result[0].weight).toBe(100);
    });

    it('should not update workoutData when existing set has higher or equal volume', async () => {
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 90, reps: 9 },
          // Equal volume to the first set — must not replace it.
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 1000, completedAt: Date.now() - 500 },
        ],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.getProgressiveOverloadData('ex-1');

      expect(result).toHaveLength(1);
      expect(result[0].weight).toBe(100);
      expect(result[0].reps).toBe(10);
      expect(result[0].volume).toBe(vol(100, 10));
    });
  });
});
