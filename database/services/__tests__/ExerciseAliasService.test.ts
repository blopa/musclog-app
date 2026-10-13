import {
  ExerciseAliasService,
  MAX_EXERCISE_ALIASES,
} from '@/database/services/ExerciseAliasService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: (field: string, condition: unknown) => ({ field, condition }),
    eq: (value: unknown) => value,
    sortBy: () => ({ kind: 'sortBy' }),
    asc: 'asc',
  },
}));

jest.mock('@/database/models/Exercise', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/ExerciseAlias', () => ({ __esModule: true, default: class {} }));

// "Squat" is a catalogue exercise whose names exist in two languages.
jest.mock('@/data/exerciseCatalogue', () => ({
  getAllLocaleExerciseNamesBySlug: () => new Map([['Squat', ['Squat', 'Agachamento']]]),
}));

jest.mock('@/database/database-instance', () => {
  const state = {
    tables: {} as Record<string, any[]>,
    batches: [] as any[][],
  };

  const decorate = (row: any) => {
    row.prepareUpdate = (updater: (record: any) => void) => {
      updater(row);
      return row;
    };
    return row;
  };

  const matches = (row: any, clauses: { field: string; condition: unknown }[]) =>
    clauses
      .filter((clause) => clause && 'field' in clause)
      .every((clause) => {
        const property = clause.field.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
        return row[property] === clause.condition;
      });

  const database = {
    get: (table: string) => ({
      query: (...clauses: any[]) => ({
        fetch: async () => (state.tables[table] ?? []).filter((row) => matches(row, clauses)),
      }),
      find: async (id: string) => {
        const row = (state.tables[table] ?? []).find((candidate) => candidate.id === id);
        if (!row) throw new Error('not found');
        return row;
      },
      prepareCreate: (builder: (record: any) => void) => {
        const record = decorate({ id: `${table}-${(state.tables[table] ?? []).length + 1}` });
        builder(record);
        record.__table = table;
        return record;
      },
    }),
    write: async (callback: () => Promise<unknown>) => callback(),
    batch: jest.fn(async (...records: any[]) => {
      state.batches.push(records);
      for (const record of records) {
        if (record.__table && !(state.tables[record.__table] ?? []).includes(record)) {
          (state.tables[record.__table] ??= []).push(record);
        }
      }
    }),
  };

  return { __esModule: true, database, mockState: state };
});

const { database, mockState } = jest.requireMock('@/database/database-instance') as {
  database: { batch: jest.Mock };
  mockState: { tables: Record<string, any[]>; batches: any[][] };
};

function exercise(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fx-Squat',
    name: 'Agachamento',
    deletedAt: null,
    searchText: 'agachamento squat',
    updatedAt: 1,
    prepareUpdate(updater: (record: any) => void) {
      updater(this);
      return this;
    },
    ...overrides,
  };
}

function alias(id: string, text: string, exerciseId = 'fx-Squat') {
  return {
    id,
    exerciseId,
    alias: text,
    deletedAt: null,
    updatedAt: 1,
    prepareUpdate(updater: (record: any) => void) {
      updater(this);
      return this;
    },
  };
}

beforeEach(() => {
  mockState.tables = { exercises: [exercise()], exercise_aliases: [] };
  mockState.batches = [];
  database.batch.mockClear();
});

describe('ExerciseAliasService.addAlias', () => {
  it('writes the alias and the rebuilt search text in ONE batch', async () => {
    const result = await ExerciseAliasService.addAlias('fx-Squat', '  Leg Day Special ');

    expect(result.ok).toBe(true);
    expect(database.batch).toHaveBeenCalledTimes(1);
    const [created, reindexed] = mockState.batches[0];
    expect(created).toMatchObject({ exerciseId: 'fx-Squat', alias: 'Leg Day Special' });
    expect(reindexed).toBe(mockState.tables.exercises[0]);
    expect(reindexed.searchText.split(' ')).toEqual(expect.arrayContaining(['special', 'leg']));
  });

  it('keeps a catalogue exercise searchable by its other-language names', async () => {
    await ExerciseAliasService.addAlias('fx-Squat', 'Sq');

    const { searchText } = mockState.tables.exercises[0];
    expect(searchText.split(' ')).toEqual(expect.arrayContaining(['squat', 'agachamento', 'sq']));
  });

  it('bumps updated_at, which list subscriptions use as their change signal', async () => {
    await ExerciseAliasService.addAlias('fx-Squat', 'Sq');

    expect(mockState.tables.exercises[0].updatedAt).toBeGreaterThan(1);
  });

  it('rejects an alias with no searchable characters', async () => {
    expect(await ExerciseAliasService.addAlias('fx-Squat', '   ')).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(await ExerciseAliasService.addAlias('fx-Squat', '%_')).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(database.batch).not.toHaveBeenCalled();
  });

  it('treats spelling variants of an existing alias as a duplicate', async () => {
    mockState.tables.exercise_aliases = [alias('a1', 'Push-Up')];

    expect(await ExerciseAliasService.addAlias('fx-Squat', 'push up')).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(database.batch).not.toHaveBeenCalled();
  });

  it('ignores deleted aliases when checking for duplicates', async () => {
    const deleted = alias('a1', 'Sq');
    deleted.deletedAt = 5 as any;
    mockState.tables.exercise_aliases = [deleted];

    expect((await ExerciseAliasService.addAlias('fx-Squat', 'Sq')).ok).toBe(true);
  });

  it('stops at the alias limit', async () => {
    mockState.tables.exercise_aliases = Array.from({ length: MAX_EXERCISE_ALIASES }, (_, i) =>
      alias(`a${i}`, `name ${i}`)
    );

    expect(await ExerciseAliasService.addAlias('fx-Squat', 'one more')).toEqual({
      ok: false,
      reason: 'limit',
    });
  });

  it('reports a missing or deleted exercise instead of throwing', async () => {
    expect(await ExerciseAliasService.addAlias('nope', 'x1')).toEqual({
      ok: false,
      reason: 'notFound',
    });

    mockState.tables.exercises = [exercise({ deletedAt: 9 })];
    expect(await ExerciseAliasService.addAlias('fx-Squat', 'x1')).toEqual({
      ok: false,
      reason: 'notFound',
    });
  });
});

describe('ExerciseAliasService.removeAlias', () => {
  it('soft-deletes the alias and drops its words from the search text in one batch', async () => {
    mockState.tables.exercise_aliases = [alias('a1', 'Quad Day'), alias('a2', 'Sq')];

    await ExerciseAliasService.removeAlias('a1');

    expect(database.batch).toHaveBeenCalledTimes(1);
    expect(mockState.tables.exercise_aliases[0].deletedAt).toEqual(expect.any(Number));
    expect(mockState.tables.exercise_aliases[1].deletedAt).toBeNull();
    const words = mockState.tables.exercises[0].searchText.split(' ');
    expect(words).toContain('sq');
    expect(words).not.toContain('quad');
  });

  it('is a no-op for an alias that is already gone', async () => {
    const gone = alias('a1', 'Sq');
    gone.deletedAt = 5 as any;
    mockState.tables.exercise_aliases = [gone];

    await ExerciseAliasService.removeAlias('a1');
    await ExerciseAliasService.removeAlias('missing');

    expect(database.batch).not.toHaveBeenCalled();
  });
});
