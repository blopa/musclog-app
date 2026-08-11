import { AppExerciseCatalogueService } from '@/database/services/AppExerciseCatalogueService';
import { LegacyExerciseCatalogueMigration } from '@/database/services/LegacyExerciseCatalogueMigration';
import { purgeRetiredExerciseImageCache } from '@/utils/exerciseImageCache';

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: {
    language: 'en-US',
    resolvedLanguage: 'en-US',
    t: (key: string) => key,
    exists: () => false,
  },
  EN_US: 'en-US',
  EXERCISES_JSON: {
    'en-US': [
      {
        exerciseSlug: 'Bench_Press',
        name: 'Bench Press',
        description: 'chest press',
      },
      { exerciseSlug: 'Squat', name: 'Squat', description: 'leg squat' },
      { exerciseSlug: 'Deadlift', name: 'Deadlift', description: 'hip hinge' },
      {
        exerciseSlug: 'Smith_Machine_Squat',
        name: 'Smith Machine Squat',
        description: 'smith squat',
      },
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
    targetMuscles: ['pectoralis_major', 'triceps'],
    loadMultiplier: 1,
  },
  {
    exerciseIndex: 2,
    __freeExerciseDbId: 'Squat',
    muscleGroup: 'legs',
    equipmentType: 'barbell',
    mechanicType: 'compound',
    targetMuscles: ['quadriceps'],
    loadMultiplier: 1.4,
  },
  {
    exerciseIndex: 3,
    __freeExerciseDbId: 'Deadlift',
    muscleGroup: 'back',
    equipmentType: 'barbell',
    mechanicType: 'compound',
    targetMuscles: ['hamstrings'],
    loadMultiplier: 1.8,
  },
  {
    exerciseIndex: 4,
    __freeExerciseDbId: 'Smith_Machine_Squat',
    muscleGroup: 'legs',
    equipmentType: 'smith_machine',
    mechanicType: 'compound',
    targetMuscles: ['quadriceps'],
    loadMultiplier: 1.3,
  },
]);

jest.mock('@/database/models/Exercise', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/ExerciseGoal', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/ExerciseMuscle', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/Muscle', () => ({ __esModule: true, default: class {} }));
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
  },
}));

const mockMuscleNameToId = new Map([
  ['pectoralis_major', 'muscle-chest'],
  ['triceps', 'muscle-triceps'],
  ['quadriceps', 'muscle-quads'],
  ['hamstrings', 'muscle-hamstrings'],
]);

jest.mock('../MuscleService', () => ({
  MuscleService: { seedMuscles: jest.fn(async () => mockMuscleNameToId) },
}));

jest.mock('@/utils/exerciseImageCache', () => ({
  purgeRetiredExerciseImageCache: jest.fn(),
}));

jest.mock('../../database-instance', () => {
  const baseTables = () => ({
    exercise_goals: [] as any[],
    exercise_muscles: [] as any[],
    exercises: [] as any[],
    muscles: [
      { id: 'muscle-chest', name: 'pectoralis_major', deletedAt: null },
      { id: 'muscle-triceps', name: 'triceps', deletedAt: null },
      { id: 'muscle-quads', name: 'quadriceps', deletedAt: null },
      { id: 'muscle-hamstrings', name: 'hamstrings', deletedAt: null },
    ],
    workout_log_exercises: [] as any[],
    workout_template_exercises: [] as any[],
  });
  let tables: Record<string, any[]> = baseTables();
  const preparedExercises: any[] = [];
  const batched: any[][] = [];
  let writeChain: Promise<unknown> = Promise.resolve();

  const decorate = (row: any, table?: string) => {
    if (table) row.__table = table;
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
          rows = clause.condition?.oneOf
            ? rows.filter((row) => clause.condition.oneOf.includes(row[property]))
            : rows.filter((row) => row[property] === clause.condition);
        }
        return rows;
      }),
    })),
    prepareCreate: jest.fn((callback: (record: any) => void) => {
      const record = decorate({ _raw: {}, __operation: 'create' }, table);
      callback(record);
      record.id = record._raw.id;
      if (table === 'exercises') preparedExercises.push(record);
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
    batched,
    getTable: (table: string) => tables[table],
    preparedExercises,
    reset: () => {
      tables = baseTables();
      preparedExercises.length = 0;
      batched.length = 0;
      writeChain = Promise.resolve();
      jest.clearAllMocks();
    },
    setTables: (next: Record<string, any[]>) => {
      tables = baseTables();
      for (const [table, rows] of Object.entries(next)) {
        tables[table] = rows.map((row) => decorate(row, table));
      }
    },
  };

  return { __esModule: true, database, mockDb };
});

const { mockDb } = jest.requireMock('../../database-instance') as {
  mockDb: {
    batched: any[][];
    getTable: (table: string) => any[];
    preparedExercises: any[];
    reset: () => void;
    setTables: (tables: Record<string, any[]>) => void;
  };
};

function catalogueExercise(
  slug: string,
  name: string,
  index: number,
  options: { equipmentType?: string; loadMultiplier?: number; muscleGroup?: string } = {}
) {
  return {
    createdAt: 1,
    deletedAt: null,
    description: `${name} description`,
    equipmentType: options.equipmentType ?? 'barbell',
    id: `fx-${slug}`,
    imageUrl: `https://musclog.app/images/exercises/${slug}/0.webp`,
    loadMultiplier: options.loadMultiplier ?? 1,
    mechanicType: 'compound',
    muscleGroup: options.muscleGroup ?? 'chest',
    name,
    orderIndex: index - 1,
    source: 'app' as const,
    updatedAt: 1,
  };
}

function retiredExercise(id: string, name: string) {
  return {
    ...catalogueExercise(`retired-${id}`, name, Number(id) || 1),
    id,
    imageUrl: `https://musclog.app/images/exercises/exercise${id}.png`,
  };
}

const currentCatalogue = () => [
  catalogueExercise('Bench_Press', 'Bench Press', 1),
  catalogueExercise('Squat', 'Squat', 2, { loadMultiplier: 1.4, muscleGroup: 'legs' }),
  catalogueExercise('Deadlift', 'Deadlift', 3, { loadMultiplier: 1.8, muscleGroup: 'back' }),
  catalogueExercise('Smith_Machine_Squat', 'Smith Machine Squat', 4, {
    equipmentType: 'smith_machine',
    loadMultiplier: 1.3,
    muscleGroup: 'legs',
  }),
];

const currentCatalogueLinks = () => [
  { exerciseId: 'fx-Bench_Press', muscleId: 'muscle-chest', role: 'primary' },
  { exerciseId: 'fx-Bench_Press', muscleId: 'muscle-triceps', role: 'primary' },
  { exerciseId: 'fx-Squat', muscleId: 'muscle-quads', role: 'primary' },
  { exerciseId: 'fx-Deadlift', muscleId: 'muscle-hamstrings', role: 'primary' },
  { exerciseId: 'fx-Smith_Machine_Squat', muscleId: 'muscle-quads', role: 'primary' },
];

describe('AppExerciseCatalogueService', () => {
  beforeEach(() => mockDb.reset());

  it('seeds rows and complete muscle-link groups through stable slug ids', async () => {
    const report = await AppExerciseCatalogueService.sync();

    expect(report).toMatchObject({ exercisesCreated: 4, linksCreated: 5, conflicts: [] });
    expect(mockDb.preparedExercises.map(({ id }) => id)).toEqual([
      'fx-Bench_Press',
      'fx-Squat',
      'fx-Deadlift',
      'fx-Smith_Machine_Squat',
    ]);
    expect(await AppExerciseCatalogueService.isComplete()).toBe(true);
  });

  it('repairs a partially committed target-muscle set instead of treating row ids as complete', async () => {
    mockDb.setTables({
      exercises: currentCatalogue(),
      exercise_muscles: currentCatalogueLinks().filter(
        ({ muscleId }) => muscleId !== 'muscle-triceps'
      ),
    });

    expect(await AppExerciseCatalogueService.isComplete()).toBe(false);
    const report = await AppExerciseCatalogueService.sync();
    expect(report.linksCreated).toBe(1);
    expect(await AppExerciseCatalogueService.isComplete()).toBe(true);
  });

  it('removes duplicate and stale links while normalizing retained roles', async () => {
    const links = currentCatalogueLinks();
    links.find(({ muscleId }) => muscleId === 'muscle-triceps')!.role = 'secondary';
    mockDb.setTables({
      exercises: currentCatalogue(),
      exercise_muscles: [
        ...links,
        { exerciseId: 'fx-Bench_Press', muscleId: 'muscle-chest', role: 'primary' },
        { exerciseId: 'fx-Bench_Press', muscleId: 'muscle-quads', role: 'primary' },
      ],
    });

    const report = await AppExerciseCatalogueService.sync();

    expect(report).toMatchObject({ linksDestroyed: 2, linksUpdated: 1 });
    expect(await AppExerciseCatalogueService.isComplete()).toBe(true);
  });

  it('persists generated Smith-machine equipment without localized-name inference', async () => {
    await AppExerciseCatalogueService.sync();

    expect(
      mockDb.getTable('exercises').find(({ id }) => id === 'fx-Smith_Machine_Squat')?.equipmentType
    ).toBe('smith_machine');
  });

  it('serializes concurrent reconciliation without preparing duplicate ids', async () => {
    await Promise.all([AppExerciseCatalogueService.sync(), AppExerciseCatalogueService.sync()]);

    const ids = mockDb.preparedExercises.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reports an occupied catalogue id instead of attempting to reuse it', async () => {
    const occupied: any = catalogueExercise('Squat', 'Squat', 2, {
      loadMultiplier: 1.4,
      muscleGroup: 'legs',
    });
    occupied.deletedAt = 123;
    mockDb.setTables({ exercises: [occupied] });

    await expect(AppExerciseCatalogueService.sync()).rejects.toThrow(
      'fx-Squat: id is occupied by a non-catalogue exercise'
    );
    expect(mockDb.preparedExercises.map(({ id }) => id)).not.toContain('fx-Squat');
  });
});

describe('LegacyExerciseCatalogueMigration', () => {
  beforeEach(() => mockDb.reset());

  it('clones referenced exercises, repoints every foreign key, and removes retired rows', async () => {
    mockDb.setTables({
      exercises: [
        ...currentCatalogue(),
        retiredExercise('1', 'Bench Press'),
        retiredExercise('2', 'Squat'),
        retiredExercise('3', 'Curl'),
      ],
      exercise_muscles: [
        ...currentCatalogueLinks(),
        { exerciseId: '1', muscleId: 'muscle-chest', role: 'primary', updatedAt: 1 },
        { exerciseId: '3', muscleId: 'muscle-triceps', role: 'primary', updatedAt: 1 },
      ],
      workout_template_exercises: [{ exerciseId: '1', updatedAt: 1 }],
      workout_log_exercises: [{ exerciseId: '2', updatedAt: 1 }],
      exercise_goals: [{ exerciseId: '2', updatedAt: 1 }],
    });

    expect(await LegacyExerciseCatalogueMigration.run()).toEqual({
      cloned: 2,
      destroyed: 3,
      repointed: 4,
    });
    expect(mockDb.getTable('workout_template_exercises')[0].exerciseId).toBe('lx-1');
    expect(mockDb.getTable('workout_log_exercises')[0].exerciseId).toBe('lx-2');
    expect(mockDb.getTable('exercise_goals')[0].exerciseId).toBe('lx-2');
    expect(
      mockDb.getTable('exercise_muscles').find(({ exerciseId }) => exerciseId === 'lx-1')
    ).toBeDefined();
    expect(purgeRetiredExerciseImageCache).toHaveBeenCalledTimes(1);
    expect(await LegacyExerciseCatalogueMigration.run()).toBeNull();
  });

  it('resumes onto an existing deterministic clone', async () => {
    const existingClone = { ...retiredExercise('lx-1', 'Bench Press'), source: 'user' };
    mockDb.setTables({
      exercises: [...currentCatalogue(), retiredExercise('1', 'Bench Press'), existingClone],
      exercise_muscles: currentCatalogueLinks(),
      workout_template_exercises: [{ exerciseId: '1', updatedAt: 1 }],
    });

    expect(await LegacyExerciseCatalogueMigration.run()).toEqual({
      cloned: 0,
      destroyed: 1,
      repointed: 1,
    });
    expect(mockDb.getTable('workout_template_exercises')[0].exerciseId).toBe('lx-1');
  });

  it('defers retirement until rows and complete muscle links are reconciled', async () => {
    mockDb.setTables({
      exercises: [...currentCatalogue(), retiredExercise('1', 'Bench Press')],
      exercise_muscles: currentCatalogueLinks().filter(
        ({ muscleId }) => muscleId !== 'muscle-triceps'
      ),
      workout_template_exercises: [{ exerciseId: '1', updatedAt: 1 }],
    });

    expect(await LegacyExerciseCatalogueMigration.run()).toBeNull();
    expect(mockDb.getTable('workout_template_exercises')[0].exerciseId).toBe('1');
    expect(purgeRetiredExerciseImageCache).not.toHaveBeenCalled();
  });
});
