import { database } from '@/database/database-instance';
import { WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import {
  calculate1RM,
  calculateEstimated1RMForSet,
  calculateSetVolume,
} from '@/utils/workoutCalculator';

import { createMockExercise } from './helpers';

/**
 * The `Q` stub keeps the operator alongside the value so `queryFixture()` below can
 * actually evaluate a query instead of relying on call ordering. `Q.eq(null)` and
 * `Q.notEq(null)` are otherwise indistinguishable once evaluated.
 */
jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => ({ op: 'eq', value })),
    notEq: jest.fn((value: any) => ({ op: 'notEq', value })),
    gte: jest.fn((value: any) => ({ op: 'gte', value })),
    lte: jest.fn((value: any) => ({ op: 'lte', value })),
    oneOf: jest.fn((values: any[]) => ({ op: 'oneOf', values })),
    sortBy: jest.fn((field: string, direction: any) => ({ sortByField: field, direction })),
    take: jest.fn((count: number) => ({ takeCount: count })),
    asc: 'asc' as const,
    desc: 'desc' as const,
  },
}));

// Modules further down the graph still reach the database through the `database/index`
// barrel; loading it for real would evaluate every WatermelonDB model against the `Q`-only
// mock above (`class X extends Model` with `Model` undefined), so point it at the same
// mocked instance.
jest.mock('../../index', () => require('../../database-instance'));

jest.mock('../../database-instance', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn((callback) => Promise.resolve(callback({} as any))),
    batch: jest.fn().mockResolvedValue(undefined),
  },
}));

// `detectPersonalRecords` / `getProgressiveOverloadData` / `calculateMuscleGroupVolume` all
// resolve the user's bodyweight (for bodyweight-exercise volume) through UserMetricService,
// which decrypts a user_metrics row. None of these tests are about that lookup.
jest.mock('../UserMetricService', () => ({
  UserMetricService: {
    getUserBodyWeightKgForVolume: jest.fn().mockResolvedValue(0),
  },
}));

const mockDatabase = database as jest.Mocked<typeof database>;

const BODY_WEIGHT_KG = 0;

/** Volume as the service computes it: an average-1RM estimate, not weight x reps. */
const vol = (weight: number, reps: number, repsInReserve = 0, equipmentType = 'barbell') =>
  calculateSetVolume(weight, reps, repsInReserve, equipmentType, BODY_WEIGHT_KG);

// ---------------------------------------------------------------------------
// In-memory database fixture
//
// Sets no longer carry `exercise_id` / `workout_log_id`: they hang off a
// `workout_log_exercises` row, and the service reads their values straight out of
// `_raw`. The fixture builds those three tables from a flat, readable set list.
// ---------------------------------------------------------------------------

interface SetSpec {
  exerciseId: string;
  workoutLogId: string;
  weight: number;
  reps: number;
  repsInReserve?: number;
  difficultyLevel?: number;
  isSkipped?: boolean;
  deleted?: boolean;
}

interface WorkoutSpec {
  id: string;
  startedAt: number;
  completedAt?: null | number;
}

type Row = Record<string, any> & { _raw: Record<string, unknown> };

const row = (fields: Record<string, any>, raw: Record<string, unknown>): Row => ({
  ...fields,
  _raw: raw,
});

function buildFixture(options: {
  exercises?: Record<string, any>[];
  sets?: SetSpec[];
  workouts?: WorkoutSpec[];
}) {
  const { exercises = [], sets = [], workouts = [] } = options;

  const logExerciseByKey = new Map<string, Row>();
  const workoutLogSets: Row[] = [];

  sets.forEach((spec, index) => {
    const key = `${spec.workoutLogId}::${spec.exerciseId}`;
    if (!logExerciseByKey.has(key)) {
      const id = `log-ex-${logExerciseByKey.size + 1}`;
      logExerciseByKey.set(
        key,
        row(
          {
            id,
            exerciseId: spec.exerciseId,
            workoutLogId: spec.workoutLogId,
            deletedAt: null,
          },
          {
            id,
            exercise_id: spec.exerciseId,
            workout_log_id: spec.workoutLogId,
            deleted_at: null,
          }
        )
      );
    }

    const logExercise = logExerciseByKey.get(key)!;
    const setId = `set-${index + 1}`;
    const deletedAt = spec.deleted ? Date.now() : null;

    workoutLogSets.push(
      row(
        {
          id: setId,
          logExerciseId: logExercise.id,
          difficultyLevel: spec.difficultyLevel ?? 5,
          isSkipped: spec.isSkipped ?? false,
        },
        {
          id: setId,
          log_exercise_id: logExercise.id,
          reps: spec.reps,
          weight: spec.weight,
          reps_in_reserve: spec.repsInReserve ?? 0,
          rest_time_after: 60,
          difficulty_level: spec.difficultyLevel ?? 5,
          is_skipped: spec.isSkipped ?? false,
          set_type: 'normal',
          set_order: index + 1,
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: deletedAt,
        }
      )
    );
  });

  const workoutLogExercises = [...logExerciseByKey.values()];

  const workoutLogs = workouts.map((spec) => {
    const logExercisesForWorkout = workoutLogExercises.filter(
      (le) => le.workoutLogId === spec.id && le.deletedAt == null
    );

    return row(
      {
        id: spec.id,
        startedAt: spec.startedAt,
        completedAt: spec.completedAt ?? null,
        logExercises: { fetch: jest.fn().mockResolvedValue(logExercisesForWorkout) },
      },
      {
        id: spec.id,
        started_at: spec.startedAt,
        completed_at: spec.completedAt ?? null,
      }
    );
  });

  const exerciseRows = exercises.map((exercise) =>
    row(exercise, {
      id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscleGroup,
      equipment_type: exercise.equipmentType,
      deleted_at: null,
    })
  );

  return {
    exercises: exerciseRows,
    workout_log_exercises: workoutLogExercises,
    workout_log_sets: workoutLogSets,
    workout_logs: workoutLogs,
  };
}

function matchesClause(raw: Record<string, unknown>, clause: any): boolean {
  const actual = raw[clause.field];
  const condition = clause.condition;

  // `Q.where('exercise_id', exerciseId)` passes a bare value rather than a Q operator.
  if (condition === null || typeof condition !== 'object') {
    return actual === condition;
  }

  switch (condition.op) {
    case 'eq':
      return condition.value === null ? actual == null : actual === condition.value;
    case 'notEq':
      return condition.value === null ? actual != null : actual !== condition.value;
    case 'gte':
      return (actual as number) >= condition.value;
    case 'lte':
      return (actual as number) <= condition.value;
    case 'oneOf':
      return condition.values.includes(actual);
    default:
      return true;
  }
}

function queryFixture(rows: Row[], clauses: any[]): Row[] {
  const whereClauses = clauses.filter((c) => c && typeof c === 'object' && 'field' in c);
  let result = rows.filter((r) => whereClauses.every((c) => matchesClause(r._raw, c)));

  const sort = clauses.find((c) => c && typeof c === 'object' && 'sortByField' in c);
  if (sort) {
    const factor = sort.direction === 'desc' ? -1 : 1;
    result = [...result].sort(
      (a, b) =>
        (((a._raw[sort.sortByField] as number) ?? 0) -
          ((b._raw[sort.sortByField] as number) ?? 0)) *
        factor
    );
  }

  const take = clauses.find((c) => c && typeof c === 'object' && 'takeCount' in c);
  if (take) {
    result = result.slice(0, take.takeCount);
  }

  return result;
}

/** Points `database.get(table)` at the fixture, dispatching by table name. */
function installFixture(tables: Partial<Record<string, Row[]>>) {
  mockDatabase.get.mockImplementation(
    (table: string) =>
      ({
        find: jest.fn(async (id: string) => {
          const found = (tables[table] ?? []).find((r) => r.id === id);
          if (!found) {
            throw new Error(`Record ${id} not found in ${table}`);
          }
          return found;
        }),
        query: jest.fn((...clauses: any[]) => ({
          extend: jest.fn().mockReturnThis(),
          fetch: jest.fn(async () => queryFixture(tables[table] ?? [], clauses)),
        })),
      }) as any
  );
}

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
            isSkipped: true,
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
            isSkipped: true,
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
            isSkipped: true,
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
            isSkipped: true,
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
            isSkipped: true,
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
