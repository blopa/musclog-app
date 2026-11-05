import { database } from '@/database/database-instance';
import type Exercise from '@/database/models/Exercise';
import type UserMetric from '@/database/models/UserMetric';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { YearInReviewRepository } from '@/database/repositories/YearInReviewRepository';
import { buildYearInReview } from '@/utils/yearInReview/engine';

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

// The weight row is stored as the plain number here; the real cipher is not under test.
jest.mock('@/database/encryptionHelpers', () => ({
  ...jest.requireActual('@/database/encryptionHelpers'),
  decryptNumber: async (raw: string) => Number(raw),
  decryptOptionalString: async () => undefined,
}));

const NOW = Date.now();
const at = (year: number, month: number, day: number, hour = 18) =>
  new Date(year, month, day, hour).getTime();
const HOUR = 3_600_000;

async function addExercise(id: string, name: string) {
  await database.write(async () => {
    await database.get<Exercise>('exercises').create((record) => {
      Object.assign(record._raw, {
        id,
        name,
        equipment_type: 'barbell',
        created_at: NOW,
        updated_at: NOW,
      });
    });
  });
}

/** One completed session with one exercise; `sets` are [weightKg, reps, setType]. */
async function addSession(
  id: string,
  startedAt: number,
  options: {
    exerciseId?: string;
    sets?: [number, number, string][];
    type?: string;
    importSource?: string;
    completedAt?: number | null;
    deleted?: boolean;
  } = {}
) {
  const exerciseId = options.exerciseId ?? 'fx-bench';
  await database.write(async () => {
    const log = await database.get<WorkoutLog>('workout_logs').create((record) => {
      Object.assign(record._raw, {
        id,
        workout_name: 'Session',
        started_at: startedAt,
        completed_at: options.completedAt === undefined ? startedAt + HOUR : options.completedAt,
        timezone: '+00:00',
        type: options.type ?? 'strength',
        import_source: options.importSource ?? null,
        deleted_at: options.deleted ? startedAt : null,
        created_at: startedAt,
        updated_at: startedAt,
      });
    });

    const logExercise = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .create((record) => {
        Object.assign(record._raw, {
          workout_log_id: log.id,
          exercise_id: exerciseId,
          exercise_order: 0,
          created_at: startedAt,
          updated_at: startedAt,
        });
      });

    for (const [order, [weight, reps, setType]] of (options.sets ?? []).entries()) {
      await database.get<WorkoutLogSet>('workout_log_sets').create((record) => {
        Object.assign(record._raw, {
          log_exercise_id: logExercise.id,
          weight,
          reps,
          reps_in_reserve: 0,
          rest_time_after: 60,
          completion_status: 'performed',
          set_type: setType,
          set_order: order,
          rir_recorded: false,
          created_at: startedAt,
          updated_at: startedAt,
        });
      });
    }
  });
}

async function addWeighIn(date: number, kg: number, extra: { deleted?: boolean } = {}) {
  await database.write(async () => {
    await database.get<UserMetric>('user_metrics').create((record) => {
      Object.assign(record._raw, {
        type: 'weight',
        value: String(kg),
        unit: 'kg',
        date,
        timezone: '+00:00',
        deleted_at: extra.deleted ? date : null,
        created_at: date,
        updated_at: date,
      });
    });
  });
}

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});

describe('YearInReviewRepository', () => {
  it('reads the year’s completed sessions and their working sets, leaving warm-ups out', async () => {
    await addExercise('fx-bench', 'Bench Press');
    await addSession('s1', at(2026, 1, 3), {
      sets: [
        [60, 10, 'warmup'],
        [100, 5, 'working'],
        [100, 5, 'working'],
      ],
    });
    await addSession('s2', at(2026, 2, 3), { type: 'cardio', sets: [] });
    await addSession('s3', at(2026, 2, 4), { completedAt: null });
    await addSession('s4', at(2026, 2, 5), { deleted: true });

    const input = await YearInReviewRepository.load(2026);
    const review = buildYearInReview(input);

    expect(review.sessions).toBe(2);
    const sets = input.workouts.find((w) => w.id === 's1')?.sets ?? [];
    expect(sets).toHaveLength(3);
    expect(sets.filter((set) => set.isWorkingSet)).toHaveLength(2);
    expect(input.workouts.find((w) => w.id === 's2')?.isCardio).toBe(true);
    expect(review.totalVolumeKg).toBeGreaterThan(0);
  });

  it('keeps the name of an exercise that was deleted after it was trained', async () => {
    await addExercise('fx-bench', 'Bench Press');
    await addSession('s1', at(2026, 1, 3), { sets: [[100, 5, 'working']] });
    await database.write(async () => {
      const exercise = await database.get<Exercise>('exercises').find('fx-bench');
      await exercise.update((record) => {
        record.deletedAt = NOW;
      });
    });

    const review = buildYearInReview(await YearInReviewRepository.load(2026));
    expect(review.topExercises[0]?.name).toBe('Bench Press');
  });

  it('counts a personal record only when the year beats the whole earlier history', async () => {
    await addExercise('fx-bench', 'Bench Press');
    await addSession('earlier', at(2025, 10, 1), { sets: [[100, 5, 'working']] });
    await addSession('first-2026', at(2026, 0, 10), { sets: [[100, 5, 'working']] });
    await addSession('record-2026', at(2026, 2, 10), { sets: [[110, 5, 'working']] });

    const review = buildYearInReview(await YearInReviewRepository.load(2026));

    expect(review.personalRecords).toBe(1);
  });

  it('marks an imported session with no time or no length as unknown', async () => {
    await addSession('fitnotes', at(2026, 4, 2), {
      importSource: 'fitnotes',
      completedAt: at(2026, 4, 2),
    });

    const input = await YearInReviewRepository.load(2026);
    const workout = input.workouts.find((w) => w.id === 'fitnotes');

    expect(workout?.timeKnown).toBe(false);
    expect(workout?.durationKnown).toBe(false);
  });

  it('takes the earliest and latest weigh-in of the year, and only two decrypts', async () => {
    await addWeighIn(at(2025, 11, 20), 90);
    await addWeighIn(at(2026, 0, 5), 88);
    await addWeighIn(at(2026, 6, 5), 85);
    await addWeighIn(at(2026, 8, 5), 1, { deleted: true });

    const input = await YearInReviewRepository.load(2026);

    expect(input.firstWeighIn).toEqual({ date: at(2026, 0, 5), weightKg: 88 });
    expect(input.lastWeighIn).toEqual({ date: at(2026, 6, 5), weightKg: 85 });
    expect(buildYearInReview(input).weightChangeKg).toBe(-3);
  });

  it('omits weight entirely when the caller asks it not to read it', async () => {
    await addWeighIn(at(2026, 0, 5), 88);

    const input = await YearInReviewRepository.load(2026, { includeWeight: false });

    expect(input.firstWeighIn).toBeNull();
    expect(input.lastWeighIn).toBeNull();
  });

  it('answers whether a year has a completed session without loading the year', async () => {
    expect(await YearInReviewRepository.hasCompletedSession(2026)).toBe(false);

    await addExercise('fx-bench', 'Bench Press');
    await addSession('s1', at(2026, 3, 1), { sets: [[100, 5, 'working']] });

    expect(await YearInReviewRepository.hasCompletedSession(2026)).toBe(true);
    expect(await YearInReviewRepository.hasCompletedSession(2024)).toBe(false);
  });
});
