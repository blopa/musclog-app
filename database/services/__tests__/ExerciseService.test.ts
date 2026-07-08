import { ExerciseService } from '@/database/services/ExerciseService';

/**
 * Regression tests for ExerciseService.syncAppExercises().
 *
 * syncAppExercises seeds any bundled app exercises that are missing from the DB,
 * inserting each with a FIXED primary key of `String(exerciseIndex)`. Because that
 * id is fixed, the sync must be idempotent by id — otherwise it re-inserts a row
 * whose primary key already exists and SQLite throws:
 *
 *   sqlite error 1555 (UNIQUE constraint failed: exercises.id)
 *
 * This crashed production builds 270 (Android/pt-BR) and 272 (iOS/en-US): those
 * versions deduped by translated NAME only, so after a locale switch or a JSON
 * name refinement an exercise whose id is already present looked "missing" by its
 * new name and got re-inserted with the same fixed id. The guard under test is the
 * id-based dedup (`existingIds`) that makes the sync locale-independent.
 */

const EN_US = 'en-US';

// Deterministic, self-contained catalogue: three app exercises, indices 1..3.
jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { language: 'en-US', t: (k: string) => k, exists: () => false },
  EN_US: 'en-US',
  EXERCISES_JSON: {
    'en-US': [
      { exerciseIndex: 1, name: 'Bench Press', description: 'chest press' },
      { exerciseIndex: 2, name: 'Squat', description: 'leg squat' },
      { exerciseIndex: 3, name: 'Deadlift', description: 'hip hinge' },
    ],
  },
}));

jest.mock('@/data/exercisesData.json', () => [
  {
    exerciseIndex: 1,
    muscleGroup: 'chest',
    equipmentType: 'barbell',
    mechanicType: 'compound',
    targetMuscles: [],
    loadMultiplier: 1,
  },
  {
    exerciseIndex: 2,
    muscleGroup: 'legs',
    equipmentType: 'barbell',
    mechanicType: 'compound',
    targetMuscles: [],
    loadMultiplier: 1,
  },
  {
    exerciseIndex: 3,
    muscleGroup: 'back',
    equipmentType: 'barbell',
    mechanicType: 'compound',
    targetMuscles: [],
    loadMultiplier: 1,
  },
]);

// Models are imported only as generic type args (`get<Exercise>(...)`); stub them
// so the real WatermelonDB model classes (which `extends Model`) never load.
jest.mock('@/database/models/Exercise', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/ExerciseMuscle', () => ({ __esModule: true, default: class {} }));

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => value),
  },
}));

jest.mock('../MuscleService', () => ({
  MuscleService: { seedMuscles: jest.fn(async () => new Map<string, string>()) },
}));

// Controllable database mock: `mockDb.setExisting()` drives what the exercises
// query returns; every `prepareCreate` is captured with the id its callback set.
jest.mock('../../index', () => {
  let existing: any[] = [];
  const preparedExercises: any[] = [];
  const preparedJunctions: any[] = [];
  const batched: any[][] = [];

  // Model WatermelonDB's serialized writer: write callbacks run one at a time,
  // and a committed batch is reflected into `existing` so a later reader (inside
  // its own writer turn) observes it. This lets the concurrency test exercise the
  // read-inside-writer guarantee — reading outside the writer would let two runs
  // both see an empty DB and prepare the same fixed id twice.
  let writeChain: Promise<unknown> = Promise.resolve();

  const exercisesCollection = {
    // Return a snapshot, not the live array: a real query result is a point-in-time
    // read, so a stale read must NOT observe rows a later batch commits in place.
    query: jest.fn(() => ({ fetch: jest.fn(async () => [...existing]) })),
    prepareCreate: jest.fn((cb: (rec: any) => void) => {
      const rec: any = { _raw: {} };
      cb(rec);
      rec.id = rec._raw.id; // WatermelonDB exposes the assigned id as record.id
      preparedExercises.push(rec);
      return rec;
    }),
  };

  const junctionCollection = {
    prepareCreate: jest.fn((cb: (rec: any) => void) => {
      const rec: any = { _raw: {} };
      cb(rec);
      preparedJunctions.push(rec);
      return rec;
    }),
  };

  const database = {
    get: jest.fn((table: string) =>
      table === 'exercises' ? exercisesCollection : junctionCollection
    ),
    write: jest.fn((cb: (writer: unknown) => Promise<unknown>) => {
      const run = writeChain.then(() => cb({}));
      writeChain = run.catch(() => undefined); // keep the queue alive past a failed write
      return run;
    }),
    batch: jest.fn(async (...records: any[]) => {
      batched.push(records);
      for (const rec of records) {
        if (rec?.source === 'app') {
          existing.push({
            id: rec.id,
            name: rec.name,
            source: rec.source,
            deletedAt: rec.deletedAt ?? null,
          });
        }
      }
    }),
  };

  const mockDb = {
    database,
    setExisting: (rows: any[]) => {
      existing = rows;
    },
    preparedExercises,
    preparedJunctions,
    batched,
    reset: () => {
      existing = [];
      preparedExercises.length = 0;
      preparedJunctions.length = 0;
      batched.length = 0;
      writeChain = Promise.resolve();
      jest.clearAllMocks();
    },
  };

  return { __esModule: true, database, mockDb };
});

const { mockDb } = jest.requireMock('../../index') as {
  mockDb: {
    setExisting: (rows: any[]) => void;
    preparedExercises: { id: string }[];
    batched: any[][];
    reset: () => void;
  };
};

const appExercise = (id: string, name: string, deletedAt: number | null = null) => ({
  id,
  name,
  source: 'app' as const,
  deletedAt,
});

const preparedIds = () => mockDb.preparedExercises.map((e) => e.id);

describe('ExerciseService.syncAppExercises', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it('seeds every bundled exercise with a fixed id on a fresh database', async () => {
    mockDb.setExisting([]);

    const created = await ExerciseService.syncAppExercises();

    expect(created).toBe(3);
    expect(preparedIds()).toEqual(['1', '2', '3']);
    expect(mockDb.batched).toHaveLength(1);
  });

  it('is a no-op when all exercises are already present (matching names and ids)', async () => {
    mockDb.setExisting([
      appExercise('1', 'Bench Press'),
      appExercise('2', 'Squat'),
      appExercise('3', 'Deadlift'),
    ]);

    const created = await ExerciseService.syncAppExercises();

    expect(created).toBe(0);
    expect(preparedIds()).toEqual([]);
    expect(mockDb.batched).toHaveLength(0);
  });

  // The exact 270/272 crash: ids are present but under stale (differently-localised)
  // names. Name-only dedup would re-insert ids "1"/"2"/"3" → UNIQUE constraint 1555.
  it('does NOT re-insert an existing id when the stored name is stale (locale switch)', async () => {
    mockDb.setExisting([
      appExercise('1', 'Supino'), // pt-BR name for index 1
      appExercise('2', 'Agachamento'), // pt-BR name for index 2
      appExercise('3', 'Levantamento Terra'), // pt-BR name for index 3
    ]);

    const created = await ExerciseService.syncAppExercises();

    expect(created).toBe(0);
    expect(preparedIds()).toEqual([]);
    expect(mockDb.batched).toHaveLength(0);
  });

  it('only seeds genuinely missing exercises, skipping ids that already exist under a stale name', async () => {
    mockDb.setExisting([
      appExercise('1', 'Bench Press'), // present, name matches
      appExercise('2', 'Agachamento'), // present by id, stale name
      // index 3 absent entirely
    ]);

    const created = await ExerciseService.syncAppExercises();

    expect(created).toBe(1);
    expect(preparedIds()).toEqual(['3']);
    expect(mockDb.batched).toHaveLength(1);
  });

  // existingIds is built from ALL rows including soft-deleted ones, because a
  // soft-deleted app exercise still occupies its primary key in SQLite.
  it('does NOT re-insert an id occupied by a soft-deleted exercise', async () => {
    mockDb.setExisting([appExercise('2', 'Squat', 1_700_000_000)]);

    const created = await ExerciseService.syncAppExercises();

    expect(created).toBe(2);
    expect(preparedIds()).toEqual(['1', '3']);
    expect(preparedIds()).not.toContain('2');
  });

  // Guards the read-inside-writer restructure: the existence check and the insert
  // run inside one serialized writer, so two concurrent boots can't both read an
  // empty DB and insert the same fixed id (which would throw sqlite 1555). Reading
  // outside the writer would prepare '1'/'2'/'3' twice and fail the uniqueness
  // assertion below.
  it('is race-safe: two concurrent runs never prepare the same fixed id twice', async () => {
    mockDb.setExisting([]);

    await Promise.all([ExerciseService.syncAppExercises(), ExerciseService.syncAppExercises()]);

    const ids = preparedIds();
    expect(new Set(ids).size).toBe(ids.length); // each id inserted at most once
    expect(new Set(ids)).toEqual(new Set(['1', '2', '3'])); // catalogue seeded exactly once
  });

  it('never prepares an exercise whose id already exists (core 1555 invariant)', async () => {
    const existing = [
      appExercise('1', 'Supino'),
      appExercise('2', 'Squat'),
      appExercise('3', 'Deadlift', 42),
    ];
    mockDb.setExisting(existing);
    const existingIds = new Set(existing.map((e) => e.id));

    await ExerciseService.syncAppExercises();

    for (const id of preparedIds()) {
      expect(existingIds.has(id)).toBe(false);
    }
    // No duplicate ids within a single batch either.
    expect(new Set(preparedIds()).size).toBe(preparedIds().length);
  });
});
