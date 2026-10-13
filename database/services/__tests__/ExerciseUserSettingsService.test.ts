import { ExerciseUserSettingsService } from '@/database/services/ExerciseUserSettingsService';
import { MAX_NOTE_LENGTH } from '@/utils/noteText';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: (field: string, condition: unknown) => ({ field, condition }),
    eq: (value: unknown) => value,
    sortBy: (field: string) => ({ kind: 'sortBy', field }),
    desc: 'desc',
  },
}));
jest.mock('@/database/models/ExerciseUserSettings', () => ({
  __esModule: true,
  default: class {},
}));

jest.mock('@/database/database-instance', () => {
  const state = { rows: [] as any[], batches: [] as any[][] };
  const decorate = (row: any) => {
    row.prepareUpdate = (updater: (r: any) => void) => {
      updater(row);
      return row;
    };
    return row;
  };
  const matches = (row: any, clauses: any[]) =>
    clauses
      .filter((clause) => clause && 'field' in clause)
      .every((clause) => {
        const property = clause.field.replace(/_([a-z])/g, (_m: string, c: string) =>
          c.toUpperCase()
        );
        // `deleted_at = null` also matches a row whose column was never set (undefined).
        return clause.condition === null
          ? row[property] == null
          : row[property] === clause.condition;
      });
  const database = {
    get: () => ({
      query: (...clauses: any[]) => ({
        fetch: async () => state.rows.filter((row) => matches(row, clauses)),
      }),
      prepareCreate: (builder: (r: any) => void) => {
        const row = decorate({ id: `r-${state.rows.length + state.batches.flat().length + 1}` });
        builder(row);
        row.__created = true;
        return row;
      },
    }),
    write: async (callback: () => Promise<unknown>) => callback(),
    batch: jest.fn(async (...records: any[]) => {
      state.batches.push(records);
      for (const record of records) {
        if (record.__created && !state.rows.includes(record)) state.rows.push(record);
      }
    }),
  };
  return { __esModule: true, database, mockState: state };
});

const { database, mockState } = jest.requireMock('@/database/database-instance') as {
  database: { batch: jest.Mock };
  mockState: { rows: any[]; batches: any[][] };
};

const row = (overrides: Record<string, unknown>) =>
  Object.assign(
    {
      id: `row-${Math.random()}`,
      exerciseId: 'ex-1',
      weightUnit: undefined,
      note: undefined,
      deletedAt: null,
      prepareUpdate(updater: (r: any) => void) {
        updater(this);
        return this;
      },
    },
    overrides
  );

beforeEach(() => {
  mockState.rows = [];
  mockState.batches = [];
  database.batch.mockClear();
});

const live = () => mockState.rows.filter((r) => !r.deletedAt);

describe('ExerciseUserSettingsService.update', () => {
  it('creates one row the first time an exercise is customised', async () => {
    await ExerciseUserSettingsService.update('ex-1', { weightUnit: 'lbs' });

    expect(live()).toHaveLength(1);
    expect(live()[0]).toMatchObject({ exerciseId: 'ex-1', weightUnit: 'lbs', note: undefined });
  });

  it('updates in place and leaves the field it was not asked about alone', async () => {
    await ExerciseUserSettingsService.update('ex-1', { weightUnit: 'kg' });
    await ExerciseUserSettingsService.update('ex-1', { note: '  elbows tucked  ' });

    expect(live()).toHaveLength(1);
    expect(live()[0]).toMatchObject({ weightUnit: 'kg', note: 'elbows tucked' });
  });

  it('distinguishes clearing a field (null) from not touching it (undefined)', async () => {
    mockState.rows = [row({ weightUnit: 'lbs', note: 'brace' })];

    await ExerciseUserSettingsService.update('ex-1', { weightUnit: null });

    expect(live()[0]).toMatchObject({ weightUnit: undefined, note: 'brace' });
  });

  it('retires the row when every field has been cleared, instead of keeping an empty shell', async () => {
    mockState.rows = [row({ weightUnit: 'lbs', note: 'brace' })];

    await ExerciseUserSettingsService.update('ex-1', { weightUnit: null, note: '   ' });

    expect(live()).toHaveLength(0);
    expect(mockState.rows[0].deletedAt).toEqual(expect.any(Number));
  });

  it('writes nothing at all when there is nothing to clear and nothing to set', async () => {
    await ExerciseUserSettingsService.update('ex-1', { weightUnit: null, note: '' });

    expect(database.batch).not.toHaveBeenCalled();
  });

  it('drops a unit this build does not understand rather than storing it', async () => {
    await ExerciseUserSettingsService.update('ex-1', { note: 'x', weightUnit: 'stone' as never });

    expect(live()[0].weightUnit).toBeUndefined();
  });

  it('caps the note length', async () => {
    await ExerciseUserSettingsService.update('ex-1', {
      note: 'a'.repeat(MAX_NOTE_LENGTH + 50),
    });

    expect(live()[0].note).toHaveLength(MAX_NOTE_LENGTH);
  });

  it('keeps one row when a restore left two for the same exercise', async () => {
    mockState.rows = [
      row({ id: 'a', weightUnit: 'kg' }),
      row({ id: 'b', weightUnit: 'lbs', note: 'dup' }),
    ];

    await ExerciseUserSettingsService.update('ex-1', { note: 'merged' });

    expect(live()).toHaveLength(1);
    expect(live()[0].id).toBe('a');
  });

  it('does not touch another exercise', async () => {
    mockState.rows = [row({ exerciseId: 'ex-2', weightUnit: 'lbs' })];

    await ExerciseUserSettingsService.update('ex-1', { weightUnit: 'kg' });

    expect(live()).toHaveLength(2);
    expect(mockState.rows[0].weightUnit).toBe('lbs');
  });
});

describe('bodyweight rep ceiling', () => {
  it('stores a picked ceiling and keeps the other fields', async () => {
    mockState.rows = [row({ note: 'full lockout' })];

    await ExerciseUserSettingsService.setRepCeiling('ex-1', 35);

    expect(live()[0]).toMatchObject({ note: 'full lockout', repCeiling: 35 });
  });

  it('does not store the default: picking 25 is the same as having no row', async () => {
    await ExerciseUserSettingsService.setRepCeiling('ex-1', 25);
    expect(database.batch).not.toHaveBeenCalled();

    mockState.rows = [row({ repCeiling: 40 })];
    await ExerciseUserSettingsService.setRepCeiling('ex-1', 25);
    expect(live()).toHaveLength(0);
  });

  it('drops a ceiling the picker does not offer', async () => {
    await ExerciseUserSettingsService.update('ex-1', { note: 'x', repCeiling: 27 });
    expect(live()[0].repCeiling).toBeUndefined();
  });

  it('resolves every exercise’s ceiling in one read, defaulting to 25', async () => {
    mockState.rows = [
      row({ exerciseId: 'dips', repCeiling: 30 }),
      row({ exerciseId: 'odd', repCeiling: 99 }),
    ];
    jest
      .spyOn(require('@/database/services/SettingsService').SettingsService, 'getUnits')
      .mockResolvedValue('metric');

    const { repCeilingFor } = await ExerciseUserSettingsService.getResolvers(null);

    expect(repCeilingFor('dips')).toBe(30);
    expect(repCeilingFor('odd')).toBe(25);
    expect(repCeilingFor('push-ups')).toBe(25);
  });
});
