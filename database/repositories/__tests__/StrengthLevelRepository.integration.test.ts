import { database } from '@/database/database-instance';
import type Exercise from '@/database/models/Exercise';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { StrengthLevelRepository } from '@/database/repositories/StrengthLevelRepository';
import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { calculateAverage1RM } from '@/utils/workoutCalculator';

jest.mock('@/database/adapter', () => {
  const Loki = jest.requireActual('@nozbe/watermelondb/adapters/lokijs').default;

  return {
    __esModule: true,
    default: new Loki({
      schema: jest.requireActual('@/database/schema').schema,
      migrations: jest.requireActual('@/database/migrations').migrations,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
      extraLokiOptions: { autosave: false },
      _testLokiAdapter: new (require('lokijs').LokiMemoryAdapter)(),
    }),
  };
});

const NOW = new Date(2026, 9, 20, 12).getTime();
const SQUAT = 'fx-Barbell_Squat';
const CURL = 'fx-Barbell_Curl';
const STRETCH = 'fx-Some_Stretch';

const LATEST_WEIGHT_KG = 80;

let decryptCalls = 0;
let weighIn: { value: number } | null = { value: LATEST_WEIGHT_KG };

async function addExercise(id: string, loadMultiplier: number, muscleGroup = 'legs') {
  await database.write(async () => {
    await database.get<Exercise>('exercises').create((record) => {
      record._raw.id = id;
      Object.assign(record._raw, {
        name: id.replace('fx-', '').replace(/_/g, ' '),
        muscle_group: muscleGroup,
        load_multiplier: loadMultiplier,
        deleted_at: null,
      });
    });
  });
}

async function addLog(startedAt: number, extra: { deleted?: boolean } = {}) {
  let logId = '';
  await database.write(async () => {
    const log = await database.get<WorkoutLog>('workout_logs').create((record) => {
      Object.assign(record._raw, {
        started_at: startedAt,
        completed_at: startedAt + 3_600_000,
        deleted_at: extra.deleted ? startedAt : null,
      });
    });
    logId = log.id;
  });
  return logId;
}

async function addExerciseBlock(logId: string, exerciseId: string) {
  let blockId = '';
  await database.write(async () => {
    const block = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .create((record) => {
        Object.assign(record._raw, {
          workout_log_id: logId,
          exercise_id: exerciseId,
          exercise_order: 0,
          deleted_at: null,
        });
      });
    blockId = block.id;
  });
  return blockId;
}

async function addSet(
  blockId: string,
  set: {
    weight?: number;
    reps?: number;
    rir?: number;
    rirRecorded?: boolean;
    setType?: string;
    performed?: boolean;
  } = {}
) {
  await database.write(async () => {
    await database.get<WorkoutLogSet>('workout_log_sets').create((record) => {
      Object.assign(record._raw, {
        log_exercise_id: blockId,
        weight: set.weight ?? 100,
        reps: set.reps ?? 5,
        reps_in_reserve: set.rir ?? 2,
        rir_recorded: set.rirRecorded ?? true,
        set_type: set.setType ?? 'normal',
        completion_status: set.performed === false ? 'planned' : 'performed',
        set_order: 0,
        rest_time_after: 0,
        deleted_at: null,
      });
    });
  });
}

/** A trained lift: one log, one block, the given sets. Returns the block id. */
async function trainLift(
  exerciseId: string,
  sets: Parameters<typeof addSet>[1][],
  startedAt = NOW - 10 * MS_PER_SOLAR_DAY
) {
  const logId = await addLog(startedAt);
  const blockId = await addExerciseBlock(logId, exerciseId);
  for (const set of sets) {
    await addSet(blockId, set);
  }
  return blockId;
}

beforeEach(async () => {
  decryptCalls = 0;
  weighIn = { value: LATEST_WEIGHT_KG };
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
  await addExercise(SQUAT, 1.4);
  await addExercise(CURL, 0.42, 'arms');
  await addExercise(STRETCH, 0);

  jest.spyOn(UserMetricService, 'getLatest').mockImplementation(async () =>
    weighIn
      ? ({
          getDecrypted: async () => {
            decryptCalls += 1;
            return { value: weighIn?.value ?? 0, unit: 'kg', date: NOW };
          },
        } as never)
      : null
  );
  jest.spyOn(UserService, 'getCurrentUser').mockResolvedValue({ gender: 'male' } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** The grades alone; the state also says whether a missing weigh-in is what is withholding them. */
async function fetchGrades(exerciseIds: readonly string[], now: number) {
  return (await StrengthLevelRepository.fetchGradeState(exerciseIds, now)).grades;
}

describe('StrengthLevelRepository.fetchGradeState grades', () => {
  it('grades a lift from its best qualifying working set', async () => {
    await trainLift(SQUAT, [
      { weight: 60, reps: 5 },
      { weight: 100, reps: 5, rir: 2 },
    ]);

    const grades = await fetchGrades([SQUAT], NOW);
    const squat = grades.get(SQUAT);

    expect(squat).toBeDefined();
    expect(squat?.exerciseName).toBe('Barbell Squat');
    expect(squat?.estimated1RmKg).toBeCloseTo(calculateAverage1RM(100, 5, 2), 6);
    expect(squat?.grade.level).toBe('intermediate');
  });

  it('ignores warm-up sets', async () => {
    await trainLift(SQUAT, [{ weight: 200, reps: 5, setType: 'warmup' }]);

    expect((await fetchGrades([SQUAT], NOW)).has(SQUAT)).toBe(false);
  });

  it('ignores sets over ten reps', async () => {
    await trainLift(SQUAT, [{ weight: 100, reps: 12 }]);

    expect((await fetchGrades([SQUAT], NOW)).has(SQUAT)).toBe(false);
  });

  it('ignores deleted logs', async () => {
    const logId = await addLog(NOW - 5 * MS_PER_SOLAR_DAY, { deleted: true });
    const blockId = await addExerciseBlock(logId, SQUAT);
    await addSet(blockId, { weight: 120, reps: 5 });

    expect((await fetchGrades([SQUAT], NOW)).has(SQUAT)).toBe(false);
  });

  it('ignores training outside the window', async () => {
    await trainLift(SQUAT, [{ weight: 120, reps: 5 }], NOW - 400 * MS_PER_SOLAR_DAY);

    expect((await fetchGrades([SQUAT], NOW)).has(SQUAT)).toBe(false);
  });

  it('gives nothing without a weigh-in, and says so', async () => {
    weighIn = null;
    await trainLift(SQUAT, [{ weight: 100, reps: 5 }]);

    const state = await StrengthLevelRepository.fetchGradeState([SQUAT], NOW);
    expect(state.grades.size).toBe(0);
    expect(state.performedWithoutWeighIn).toBe(true);
  });

  it('does not report a missing weigh-in when the lift has no qualifying set', async () => {
    await trainLift(SQUAT, [{ weight: 100, reps: 12 }]);

    const state = await StrengthLevelRepository.fetchGradeState([SQUAT], NOW);
    expect(state.grades.size).toBe(0);
    expect(state.performedWithoutWeighIn).toBe(false);
  });

  it('leaves out a lift whose multiplier is zero, even when trained', async () => {
    await trainLift(STRETCH, [{ weight: 40, reps: 5 }]);

    expect((await fetchGrades([STRETCH], NOW)).has(STRETCH)).toBe(false);
  });

  it('decrypts the body weight exactly once, however many lifts and sets it reads', async () => {
    await trainLift(SQUAT, [
      { weight: 100, reps: 5 },
      { weight: 110, reps: 3 },
    ]);
    await trainLift(CURL, [
      { weight: 20, reps: 8 },
      { weight: 22, reps: 6 },
    ]);

    const grades = await fetchGrades([SQUAT, CURL], NOW);

    expect(grades.size).toBe(2);
    expect(decryptCalls).toBe(1);
  });

  it('returns an empty map for an empty id list without touching the database', async () => {
    const spy = jest.spyOn(UserMetricService, 'getLatest');

    expect((await fetchGrades([], NOW)).size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});
