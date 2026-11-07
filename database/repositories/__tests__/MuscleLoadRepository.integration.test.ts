import type Exercise from '@/database/models/Exercise';
import type ExerciseMuscle from '@/database/models/ExerciseMuscle';
import type Muscle from '@/database/models/Muscle';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { database } from '@/database/database-instance';
import { MuscleLoadRepository } from '@/database/repositories/MuscleLoadRepository';

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

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 20, 12).getTime();
const RECENT = NOW - 2 * DAY;

async function addMuscle(name: string, deleted = false): Promise<string> {
  let id = '';
  await database.write(async () => {
    const muscle = await database.get<Muscle>('muscles').create((record) => {
      Object.assign(record._raw, {
        name,
        muscle_group: 'arms',
        display_name: name,
        deleted_at: deleted ? NOW : null,
      });
    });
    id = muscle.id;
  });
  return id;
}

async function addExercise(name: string, mechanicType = 'compound'): Promise<string> {
  let id = '';
  await database.write(async () => {
    const exercise = await database.get<Exercise>('exercises').create((record) => {
      Object.assign(record._raw, { name, mechanic_type: mechanicType, muscle_group: 'chest' });
    });
    id = exercise.id;
  });
  return id;
}

async function link(exerciseId: string, muscleId: string, role: string, deleted = false) {
  await database.write(async () => {
    await database.get<ExerciseMuscle>('exercise_muscles').create((record) => {
      Object.assign(record._raw, {
        exercise_id: exerciseId,
        muscle_id: muscleId,
        role,
        deleted_at: deleted ? NOW : null,
      });
    });
  });
}

async function addSession(
  startedAt: number,
  extra: { completed?: boolean; deleted?: boolean; name?: string } = {}
): Promise<string> {
  let id = '';
  await database.write(async () => {
    const log = await database.get<WorkoutLog>('workout_logs').create((record) => {
      Object.assign(record._raw, {
        workout_name: extra.name ?? 'Push day',
        started_at: startedAt,
        completed_at: extra.completed === false ? null : startedAt + 3_600_000,
        deleted_at: extra.deleted ? startedAt : null,
      });
    });
    id = log.id;
  });
  return id;
}

async function addBlock(sessionId: string, exerciseId: string, deleted = false): Promise<string> {
  let id = '';
  await database.write(async () => {
    const block = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .create((record) => {
        Object.assign(record._raw, {
          workout_log_id: sessionId,
          exercise_id: exerciseId,
          exercise_order: 0,
          deleted_at: deleted ? NOW : null,
        });
      });
    id = block.id;
  });
  return id;
}

async function addSet(
  blockId: string,
  values: {
    status?: string;
    setType?: string;
    reps?: number;
    weight?: number;
    deleted?: boolean;
  } = {}
) {
  await database.write(async () => {
    await database.get<WorkoutLogSet>('workout_log_sets').create((record) => {
      Object.assign(record._raw, {
        log_exercise_id: blockId,
        reps: values.reps ?? 8,
        weight: values.weight ?? 60,
        completion_status: values.status ?? 'performed',
        set_type: values.setType ?? 'working',
        deleted_at: values.deleted ? NOW : null,
      });
    });
  });
}

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});

describe('MuscleLoadRepository.fetchRecentSets', () => {
  it('returns the performed working sets of a completed session with their muscle roles', async () => {
    const chest = await addMuscle('pectoralis_major');
    const triceps = await addMuscle('triceps');
    const bench = await addExercise('Bench Press', 'compound');
    await link(bench, chest, 'primary');
    await link(bench, triceps, 'secondary');
    const session = await addSession(RECENT, { name: 'Push' });
    const block = await addBlock(session, bench);
    await addSet(block, { reps: 5, weight: 100 });

    const sets = await MuscleLoadRepository.fetchRecentSets(NOW);

    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({
      sessionId: session,
      exerciseId: bench,
      exerciseName: 'Bench Press',
      reps: 5,
      weightKg: 100,
      workoutName: 'Push',
      isWorkingSet: true,
      mechanicType: 'compound',
      performedAt: RECENT + 3_600_000,
    });
    expect(sets[0].muscles).toEqual(
      expect.arrayContaining([
        { name: 'pectoralis_major', role: 'primary' },
        { name: 'triceps', role: 'secondary' },
      ])
    );
  });

  it('flags warm-ups and skipped sets instead of counting them as working', async () => {
    const chest = await addMuscle('pectoralis_major');
    const bench = await addExercise('Bench Press');
    await link(bench, chest, 'primary');
    const block = await addBlock(await addSession(RECENT), bench);
    await addSet(block, { setType: 'warmup' });
    await addSet(block, { status: 'skipped' });
    await addSet(block, { status: 'planned' });
    await addSet(block);

    const sets = await MuscleLoadRepository.fetchRecentSets(NOW);

    expect(sets.map((set) => set.isWorkingSet).sort()).toEqual([false, false, false, true]);
  });

  it('leaves out deleted and in-progress sessions, deleted blocks and deleted sets', async () => {
    const chest = await addMuscle('pectoralis_major');
    const bench = await addExercise('Bench Press');
    await link(bench, chest, 'primary');

    const live = await addBlock(await addSession(RECENT), bench);
    await addSet(live);

    const deletedSession = await addBlock(await addSession(RECENT, { deleted: true }), bench);
    await addSet(deletedSession);

    const inProgress = await addBlock(await addSession(RECENT, { completed: false }), bench);
    await addSet(inProgress);

    const deletedBlock = await addBlock(await addSession(RECENT), bench, true);
    await addSet(deletedBlock);

    await addSet(live, { deleted: true });

    const sets = await MuscleLoadRepository.fetchRecentSets(NOW);

    expect(sets).toHaveLength(1);
  });

  it('keeps only sessions that started inside the seven-day window', async () => {
    const chest = await addMuscle('pectoralis_major');
    const bench = await addExercise('Bench Press');
    await link(bench, chest, 'primary');
    await addSet(await addBlock(await addSession(NOW - 8 * DAY), bench));
    await addSet(await addBlock(await addSession(NOW - 6 * DAY), bench));

    const sets = await MuscleLoadRepository.fetchRecentSets(NOW);

    expect(sets).toHaveLength(1);
    expect(sets[0].performedAt).toBe(NOW - 6 * DAY + 3_600_000);
  });

  it('drops a muscle link whose muscle is gone or deleted, and keeps the rest', async () => {
    const chest = await addMuscle('pectoralis_major');
    const gone = await addMuscle('triceps', true);
    const bench = await addExercise('Bench Press');
    await link(bench, chest, 'primary');
    await link(bench, gone, 'secondary');
    await link(bench, await addMuscle('lats'), 'primary', true);
    await addSet(await addBlock(await addSession(RECENT), bench));

    const [set] = await MuscleLoadRepository.fetchRecentSets(NOW);

    expect(set.muscles).toEqual([{ name: 'pectoralis_major', role: 'primary' }]);
  });

  it('returns nothing when there are no sessions', async () => {
    expect(await MuscleLoadRepository.fetchRecentSets(NOW)).toEqual([]);
  });
});
