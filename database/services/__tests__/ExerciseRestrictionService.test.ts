import {
  ExerciseRestrictionService,
  MAX_EXERCISE_RESTRICTIONS,
} from '@/database/services/ExerciseRestrictionService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: (field: string, condition: unknown) => ({ field, condition }),
    eq: (value: unknown) => value,
    sortBy: (field: string) => ({ kind: 'sortBy', field }),
    desc: 'desc',
  },
}));
jest.mock('@/database/models/ExerciseRestriction', () => ({ __esModule: true, default: class {} }));

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
        return row[property] === clause.condition;
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
      kind: 'dislike',
      deletedAt: null,
      expiresAt: undefined,
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

describe('ExerciseRestrictionService.set', () => {
  it('creates one live restriction', async () => {
    expect(await ExerciseRestrictionService.set('ex-1', 'never')).toEqual({ ok: true });

    expect(mockState.rows).toHaveLength(1);
    expect(mockState.rows[0]).toMatchObject({ exerciseId: 'ex-1', kind: 'never' });
  });

  it('replaces rather than stacks: the new kind is the answer', async () => {
    mockState.rows = [row({ kind: 'dislike' })];

    await ExerciseRestrictionService.set('ex-1', 'injury', { note: ' left shoulder ' });

    expect(mockState.rows).toHaveLength(1);
    expect(mockState.rows[0]).toMatchObject({ kind: 'injury', note: 'left shoulder' });
  });

  it('keeps an injury expiry, but drops one on a restriction that cannot heal', async () => {
    await ExerciseRestrictionService.set('ex-1', 'injury', { expiresAt: 123 });
    await ExerciseRestrictionService.set('ex-2', 'never', { expiresAt: 123 });
    await ExerciseRestrictionService.set('ex-3', 'dislike', { expiresAt: 123 });

    expect(mockState.rows.map((r) => r.expiresAt)).toEqual([123, undefined, undefined]);
  });

  it('retires duplicate live rows an older build or a restore left behind', async () => {
    const a = row({ id: 'a' });
    const b = row({ id: 'b' });
    mockState.rows = [a, b];

    await ExerciseRestrictionService.set('ex-1', 'never');

    expect(a.kind).toBe('never');
    expect(b.deletedAt).toEqual(expect.any(Number));
    expect(database.batch).toHaveBeenCalledTimes(1);
  });

  it('refuses a new exercise past the limit, but still updates one already restricted', async () => {
    mockState.rows = Array.from({ length: MAX_EXERCISE_RESTRICTIONS }, (_, i) =>
      row({ id: `r${i}`, exerciseId: `ex-${i}` })
    );

    expect(await ExerciseRestrictionService.set('brand-new', 'never')).toEqual({
      ok: false,
      reason: 'limit',
    });
    expect(await ExerciseRestrictionService.set('ex-0', 'never')).toEqual({ ok: true });
  });
});

describe('ExerciseRestrictionService.clear', () => {
  it('soft-deletes every live row for the exercise and no other', async () => {
    const mine = row({ exerciseId: 'ex-1' });
    const other = row({ exerciseId: 'ex-2' });
    mockState.rows = [mine, other];

    await ExerciseRestrictionService.clear('ex-1');

    expect(mine.deletedAt).toEqual(expect.any(Number));
    expect(other.deletedAt).toBeNull();
  });

  it('does nothing when there is nothing to clear', async () => {
    await ExerciseRestrictionService.clear('ex-1');
    expect(database.batch).not.toHaveBeenCalled();
  });
});

describe('ExerciseRestrictionService.listActive', () => {
  it('drops an injury that has healed and keeps everything else', async () => {
    const now = 1_000;
    mockState.rows = [
      row({ exerciseId: 'healed', kind: 'injury', expiresAt: now - 1 }),
      row({ exerciseId: 'hurt', kind: 'injury', expiresAt: now + 1 }),
      row({ exerciseId: 'never', kind: 'never' }),
    ];

    const active = await ExerciseRestrictionService.listActive(now);

    expect(active.map((r) => r.exerciseId).sort()).toEqual(['hurt', 'never']);
  });
});
