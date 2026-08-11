import { ExerciseService } from '@/database/services/ExerciseService';
import { purgeRetiredExerciseImageCache } from '@/utils/exerciseImageCache';

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { language: 'en-US', t: (key: string) => key, exists: () => false },
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
    __freeExerciseDbId: 'Bench_Press',
    muscleGroup: 'chest',
    equipmentType: 'barbell',
    mechanicType: 'compound',
    targetMuscles: [],
    loadMultiplier: 1,
  },
  {
    exerciseIndex: 2,
    __freeExerciseDbId: 'Squat',
    muscleGroup: 'legs',
    equipmentType: 'barbell',
    mechanicType: 'compound',
    targetMuscles: [],
    loadMultiplier: 1,
  },
  {
    exerciseIndex: 3,
    __freeExerciseDbId: 'Deadlift',
    muscleGroup: 'back',
    equipmentType: 'barbell',
    mechanicType: 'compound',
    targetMuscles: [],
    loadMultiplier: 1,
  },
]);

jest.mock('@/database/models/Exercise', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/ExerciseGoal', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/ExerciseMuscle', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/WorkoutLogExercise', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/WorkoutTemplateExercise', () => ({
  __esModule: true,
  default: class {},
}));

jest.mock('@nozbe/watermelondb', () => ({
  Model: class {},
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ condition, field })),
    eq: jest.fn((value: unknown) => value),
    oneOf: jest.fn((values: unknown[]) => ({ oneOf: values })),
    sortBy: jest.fn(),
    asc: 'asc',
  },
}));

jest.mock('../MuscleService', () => ({
  MuscleService: { seedMuscles: jest.fn(async () => new Map<string, string>()) },
}));

jest.mock('@/utils/exerciseImageCache', () => ({
  purgeRetiredExerciseImageCache: jest.fn(),
}));

jest.mock('../../index', () => {
  let tables: Record<string, any[]> = {
    exercise_goals: [],
    exercise_muscles: [],
    exercises: [],
    workout_log_exercises: [],
    workout_template_exercises: [],
  };
  const preparedExercises: any[] = [];
  const preparedJunctions: any[] = [];
  const batched: any[][] = [];
  let writeChain: Promise<unknown> = Promise.resolve();

  const decorate = (row: any) => {
    row.prepareUpdate ??= (updater: (record: any) => void) => {
      updater(row);
      row.__operation = 'update';
      return row;
    };
    row.prepareDestroyPermanently ??= () => {
      row.__operation = 'destroy';
      return row;
    };
    return row;
  };

  const collection = (table: string) => ({
    query: jest.fn((...clauses: { condition: any; field: string }[]) => ({
      fetch: jest.fn(async () => {
        let rows = [...(tables[table] ?? [])];
        for (const clause of clauses.filter(Boolean)) {
          const property = clause.field.replace(/_([a-z])/g, (_match, letter) =>
            letter.toUpperCase()
          );
          if (clause.condition?.oneOf) {
            rows = rows.filter((row) => clause.condition.oneOf.includes(row[property]));
          } else {
            rows = rows.filter((row) => row[property] === clause.condition);
          }
        }
        return rows;
      }),
    })),
    prepareCreate: jest.fn((callback: (record: any) => void) => {
      const record = decorate({ _raw: {}, __operation: 'create', __table: table });
      callback(record);
      record.id = record._raw.id;
      if (table === 'exercises') {
        preparedExercises.push(record);
      } else {
        preparedJunctions.push(record);
      }
      return record;
    }),
  });

  const database = {
    get: jest.fn((table: string) => collection(table)),
    write: jest.fn((callback: () => Promise<unknown>) => {
      const run = writeChain.then(callback);
      writeChain = run.catch(() => undefined);
      return run;
    }),
    batch: jest.fn(async (...records: any[]) => {
      batched.push(records);
      for (const record of records) {
        if (record.__operation === 'create') {
          tables[record.__table].push(record);
        } else if (record.__operation === 'destroy') {
          for (const rows of Object.values(tables)) {
            const index = rows.indexOf(record);
            if (index >= 0) rows.splice(index, 1);
          }
        }
        delete record.__operation;
      }
    }),
  };

  const mockDb = {
    database,
    getTable: (table: string) => tables[table],
    setTables: (next: Record<string, any[]>) => {
      tables = {
        exercise_goals: [],
        exercise_muscles: [],
        exercises: [],
        workout_log_exercises: [],
        workout_template_exercises: [],
        ...Object.fromEntries(
          Object.entries(next).map(([table, rows]) => [table, rows?.map(decorate) ?? []])
        ),
      };
    },
    preparedExercises,
    preparedJunctions,
    batched,
    reset: () => {
      tables = {
        exercise_goals: [],
        exercise_muscles: [],
        exercises: [],
        workout_log_exercises: [],
        workout_template_exercises: [],
      };
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
    batched: any[][];
    getTable: (table: string) => any[];
    preparedExercises: any[];
    reset: () => void;
    setTables: (tables: Record<string, any[]>) => void;
  };
};

const appExercise = (id: string, name: string, deletedAt: number | null = null) => ({
  createdAt: 1,
  deletedAt,
  description: `${name} description`,
  equipmentType: 'barbell',
  id,
  imageUrl: `https://musclog.app/images/exercises/exercise${id}.png`,
  loadMultiplier: 1,
  mechanicType: 'compound',
  muscleGroup: 'chest',
  name,
  source: 'app' as const,
  updatedAt: 1,
});

const preparedIds = () => mockDb.preparedExercises.map((exercise) => exercise.id);
const currentCatalogue = () => [
  appExercise('fx-Bench_Press', 'Bench Press'),
  appExercise('fx-Squat', 'Squat'),
  appExercise('fx-Deadlift', 'Deadlift'),
];

describe('ExerciseService.syncAppExercises', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it('seeds every bundled exercise in the slug id namespace', async () => {
    const created = await ExerciseService.syncAppExercises();

    expect(created).toBe(3);
    expect(preparedIds()).toEqual(['fx-Bench_Press', 'fx-Squat', 'fx-Deadlift']);
    expect(mockDb.batched).toHaveLength(1);
  });

  it('is a no-op when all slug ids already exist, regardless of stored names', async () => {
    mockDb.setTables({
      exercises: [
        appExercise('fx-Bench_Press', 'Supino'),
        appExercise('fx-Squat', 'Agachamento'),
        appExercise('fx-Deadlift', 'Levantamento Terra'),
      ],
    });

    expect(await ExerciseService.syncAppExercises()).toBe(0);
    expect(preparedIds()).toEqual([]);
  });

  it('does not let an old numeric id or a duplicate name suppress the new catalogue row', async () => {
    mockDb.setTables({ exercises: [appExercise('1', 'Bench Press')] });

    await ExerciseService.syncAppExercises();

    expect(preparedIds()).toContain('fx-Bench_Press');
  });

  it('does not reuse an id occupied by a soft-deleted row', async () => {
    mockDb.setTables({ exercises: [appExercise('fx-Squat', 'Squat', 1_700_000_000)] });

    await ExerciseService.syncAppExercises();

    expect(preparedIds()).toEqual(['fx-Bench_Press', 'fx-Deadlift']);
  });

  it('serializes the authoritative read so concurrent runs never prepare an id twice', async () => {
    await Promise.all([ExerciseService.syncAppExercises(), ExerciseService.syncAppExercises()]);

    expect(new Set(preparedIds()).size).toBe(preparedIds().length);
    expect(new Set(preparedIds())).toEqual(new Set(['fx-Bench_Press', 'fx-Squat', 'fx-Deadlift']));
  });
});

describe('ExerciseService.migrateLegacyAppExercises', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it('clones referenced exercises, repoints every foreign key, and removes all old app rows in one launch', async () => {
    mockDb.setTables({
      exercises: [
        ...currentCatalogue(),
        appExercise('1', 'Bench Press'),
        appExercise('2', 'Squat'),
        appExercise('3', 'Curl'),
      ],
      workout_template_exercises: [{ exerciseId: '1', updatedAt: 1 }],
      workout_log_exercises: [{ exerciseId: '2', updatedAt: 1 }],
      exercise_goals: [{ exerciseId: '2', updatedAt: 1 }],
      exercise_muscles: [
        { exerciseId: '1', muscleId: 'chest', updatedAt: 1 },
        { exerciseId: '3', muscleId: 'biceps', updatedAt: 1 },
      ],
    });

    const report = await ExerciseService.migrateLegacyAppExercises();

    expect(report).toEqual({
      cloned: 2,
      destroyed: 3,
      repointed: 4,
      skippedStillReferenced: 0,
    });
    const migratedExercises = mockDb.getTable('exercises').filter(({ id }) => id.startsWith('lx-'));
    expect(
      mockDb
        .getTable('exercises')
        .map(({ id }) => id)
        .sort()
    ).toEqual(['fx-Bench_Press', 'fx-Deadlift', 'fx-Squat', 'lx-1', 'lx-2']);
    expect(migratedExercises.every(({ source }) => source === 'user')).toBe(true);
    expect(migratedExercises.map(({ imageUrl }) => imageUrl)).toEqual([
      'https://musclog.app/images/exercises/legacy/exercise1.webp',
      'https://musclog.app/images/exercises/legacy/exercise2.webp',
    ]);
    expect(mockDb.getTable('workout_template_exercises')[0].exerciseId).toBe('lx-1');
    expect(mockDb.getTable('workout_log_exercises')[0].exerciseId).toBe('lx-2');
    expect(mockDb.getTable('exercise_goals')[0].exerciseId).toBe('lx-2');
    expect(mockDb.getTable('exercise_muscles')).toHaveLength(1);
    expect(mockDb.getTable('exercise_muscles')[0].exerciseId).toBe('lx-1');
    expect(purgeRetiredExerciseImageCache).toHaveBeenCalledTimes(1);
    expect(await ExerciseService.migrateLegacyAppExercises()).toBeNull();
  });

  it('resumes onto an existing deterministic clone without duplicating it', async () => {
    const existingClone = { ...appExercise('lx-1', 'Bench Press'), source: 'user' };
    mockDb.setTables({
      exercises: [...currentCatalogue(), appExercise('1', 'Bench Press'), existingClone],
      workout_template_exercises: [{ exerciseId: '1', updatedAt: 1 }],
    });

    const report = await ExerciseService.migrateLegacyAppExercises();

    expect(report).toEqual({
      cloned: 0,
      destroyed: 1,
      repointed: 1,
      skippedStillReferenced: 0,
    });
    expect(mockDb.getTable('exercises')).toContainEqual(expect.objectContaining({ id: 'lx-1' }));
    expect(mockDb.getTable('workout_template_exercises')[0].exerciseId).toBe('lx-1');
  });

  it('defers retirement when the replacement catalogue is incomplete', async () => {
    mockDb.setTables({
      exercises: [appExercise('fx-Bench_Press', 'Bench Press'), appExercise('1', 'Bench Press')],
      workout_template_exercises: [{ exerciseId: '1', updatedAt: 1 }],
    });

    expect(await ExerciseService.migrateLegacyAppExercises()).toBeNull();
    expect(mockDb.getTable('exercises').map(({ id }) => id)).toEqual(['fx-Bench_Press', '1']);
    expect(mockDb.getTable('workout_template_exercises')[0].exerciseId).toBe('1');
    expect(purgeRetiredExerciseImageCache).not.toHaveBeenCalled();
  });
});
