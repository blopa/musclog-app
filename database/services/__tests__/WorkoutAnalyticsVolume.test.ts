import './workoutAnalyticsMocks';

import { database } from '@/database/database-instance';
import { WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import { calculateEstimated1RMForSet } from '@/utils/workoutCalculator';
import { createMockExercise } from './helpers';
import { BODY_WEIGHT_KG, vol, row, buildFixture, installFixture } from './workoutAnalyticsFixture';

describe('WorkoutAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installFixture({});
  });

  describe('calculateMuscleGroupVolume', () => {
    it('should calculate volume per muscle group correctly', async () => {
      const fixture = buildFixture({
        exercises: [createMockExercise({ id: 'ex-1', muscleGroup: 'chest' })],
        sets: [{ exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 }],
        workouts: [{ id: 'workout-1', startedAt: Date.now() }],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume([
        fixture.workout_logs[0] as any,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].muscleGroup).toBe('chest');
      expect(result[0].totalVolume).toBe(vol(100, 10));
      expect(result[0].exerciseCount).toBe(1);
    });

    it('excludes skipped sets from muscle-group volume', async () => {
      const fixture = buildFixture({
        exercises: [createMockExercise({ id: 'ex-1', muscleGroup: 'chest' })],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          {
            exerciseId: 'ex-1',
            workoutLogId: 'workout-1',
            weight: 200,
            reps: 10,
            difficultyLevel: 0,
            completionStatus: 'skipped',
          },
        ],
        workouts: [{ id: 'workout-1', startedAt: Date.now(), completedAt: Date.now() }],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume([
        fixture.workout_logs[0] as any,
      ]);

      expect(result[0].totalVolume).toBe(vol(100, 10));
    });

    it('should count unique exercises per muscle group', async () => {
      const fixture = buildFixture({
        exercises: [
          createMockExercise({ id: 'ex-1', muscleGroup: 'chest' }),
          createMockExercise({ id: 'ex-2', muscleGroup: 'chest' }),
        ],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { exerciseId: 'ex-2', workoutLogId: 'workout-1', weight: 80, reps: 12 },
        ],
        workouts: [{ id: 'workout-1', startedAt: Date.now() }],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume([
        fixture.workout_logs[0] as any,
      ]);

      expect(result[0].exerciseCount).toBe(2);
      expect(result[0].totalVolume).toBeCloseTo(vol(100, 10) + vol(80, 12), 5);
    });

    it('should filter by timeframe when provided', async () => {
      const fixture = buildFixture({
        exercises: [createMockExercise({ id: 'ex-1', muscleGroup: 'chest' })],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 105, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() - 5000 },
          { id: 'workout-2', startedAt: Date.now() - 1000 },
        ],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume(
        [fixture.workout_logs[0] as any, fixture.workout_logs[1] as any],
        { endDate: Date.now(), startDate: Date.now() - 2000 }
      );

      expect(result[0].totalVolume).toBe(vol(105, 10)); // Only workout-2
    });

    it('looks every exercise up in one query instead of one find per set', async () => {
      const fixture = buildFixture({
        exercises: [
          createMockExercise({ id: 'ex-1', muscleGroup: 'chest' }),
          createMockExercise({ id: 'ex-2', muscleGroup: 'back' }),
        ],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 8 },
          { exerciseId: 'ex-2', workoutLogId: 'workout-2', weight: 80, reps: 12 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() },
          { id: 'workout-2', startedAt: Date.now() },
        ],
      });
      installFixture(fixture);
      const exercisesFind = jest.fn();
      const exercisesQuery = jest.fn(() => ({
        fetch: jest.fn().mockResolvedValue(fixture.exercises),
      }));
      const base = (database.get as jest.Mock).getMockImplementation()!;
      (database.get as jest.Mock).mockImplementation((table: string) =>
        table === 'exercises' ? { find: exercisesFind, query: exercisesQuery } : base(table)
      );

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume(
        fixture.workout_logs as any[]
      );

      expect(exercisesFind).not.toHaveBeenCalled();
      expect(exercisesQuery).toHaveBeenCalledTimes(1);
      expect(result.map((r) => r.muscleGroup).sort()).toEqual(['back', 'chest']);
    });

    it('should handle exercise not found gracefully', async () => {
      const fixture = buildFixture({
        // No `exercises` row for ex-1.
        sets: [{ exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 }],
        workouts: [{ id: 'workout-1', startedAt: Date.now() }],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume([
        fixture.workout_logs[0] as any,
      ]);

      expect(result).toEqual([]);
    });

    it('should return empty array when no workouts', async () => {
      const result = await WorkoutAnalytics.calculateMuscleGroupVolume([]);

      expect(result).toEqual([]);
    });

    it('should group sets correctly across workouts', async () => {
      const fixture = buildFixture({
        exercises: [createMockExercise({ id: 'ex-1', muscleGroup: 'chest' })],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 10 },
          { exerciseId: 'ex-1', workoutLogId: 'workout-2', weight: 105, reps: 10 },
        ],
        workouts: [
          { id: 'workout-1', startedAt: Date.now() },
          { id: 'workout-2', startedAt: Date.now() },
        ],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.calculateMuscleGroupVolume([
        fixture.workout_logs[0] as any,
        fixture.workout_logs[1] as any,
      ]);

      expect(result[0].totalVolume).toBeCloseTo(vol(100, 10) + vol(105, 10), 5);
      expect(result[0].exerciseCount).toBe(1); // Same exercise
    });
  });

  describe('skipped-set exclusions in exercise metrics', () => {
    const benchPress = createMockExercise({ id: 'ex-1', name: 'Bench Press' });

    it('does not accept a skipped single as a performed 1RM', async () => {
      const now = Date.now();
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          {
            exerciseId: 'ex-1',
            workoutLogId: 'workout-1',
            weight: 200,
            reps: 1,
            difficultyLevel: 0,
            completionStatus: 'skipped',
          },
        ],
        workouts: [{ id: 'workout-1', startedAt: now - 1000, completedAt: now - 500 }],
      });
      installFixture(fixture);

      await expect(
        WorkoutAnalytics.getPerformed1RMDate('ex-1', 150, now - 2000)
      ).resolves.toBeNull();
    });

    it('uses the first logged set, not an earlier skipped set, for recent 1RM averages', async () => {
      const now = Date.now();
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          {
            exerciseId: 'ex-1',
            workoutLogId: 'workout-1',
            weight: 200,
            reps: 10,
            difficultyLevel: 0,
            completionStatus: 'skipped',
          },
          { exerciseId: 'ex-1', workoutLogId: 'workout-1', weight: 100, reps: 5 },
        ],
        workouts: [{ id: 'workout-1', startedAt: now - 1000, completedAt: now - 500 }],
      });
      installFixture(fixture);

      const result = await WorkoutAnalytics.getRecentFirstSetAverage1RM('ex-1', 2);

      expect(result).toEqual({
        average1RM: calculateEstimated1RMForSet(100, 5, 0, 'barbell', BODY_WEIGHT_KG),
        setCount: 1,
      });
    });

    it('does not count a workout toward frequency when that exercise was entirely skipped', async () => {
      const now = Date.now();
      const fixture = buildFixture({
        exercises: [benchPress],
        sets: [
          { exerciseId: 'ex-1', workoutLogId: 'workout-logged', weight: 100, reps: 5 },
          {
            exerciseId: 'ex-1',
            workoutLogId: 'workout-skipped',
            weight: 100,
            reps: 5,
            difficultyLevel: 0,
            completionStatus: 'skipped',
          },
        ],
        workouts: [
          { id: 'workout-logged', startedAt: now - 1000, completedAt: now - 500 },
          { id: 'workout-skipped', startedAt: now - 2000, completedAt: now - 1500 },
        ],
      });
      installFixture(fixture);

      await expect(WorkoutAnalytics.getAverageFrequencyPerWeek('ex-1', 1)).resolves.toEqual({
        value: 1,
        unit: 'perWeek',
      });
    });
  });
});
