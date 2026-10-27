import {
  isLegacyV1Dump,
  LEGACY_V1_TABLES,
  legacyCreateTableSql,
  legacyInsertSql,
  planLegacyV1Tables,
  quoteSqlIdentifier,
  toLegacySqlValue,
} from '@/utils/legacyV1Backup';

describe('isLegacyV1Dump', () => {
  it('accepts a 1.x dump: old table names and no export version', () => {
    expect(isLegacyV1Dump({ Exercise: [], Set: [], Versioning: [{ version: '1.8.5' }] })).toBe(
      true
    );
  });

  // Every 2.0 export carries `_exportVersion`; a 2.0 dump must never be routed to the
  // 1.x conversion, even one that happens to share a key name.
  it('rejects anything with an export version', () => {
    expect(isLegacyV1Dump({ _exportVersion: 26, Exercise: [] })).toBe(false);
    expect(isLegacyV1Dump({ _exportVersion: 26, users: [] })).toBe(false);
  });

  it('rejects values that are not a 1.x dump', () => {
    expect(isLegacyV1Dump(null)).toBe(false);
    expect(isLegacyV1Dump([])).toBe(false);
    expect(isLegacyV1Dump({ users: [] })).toBe(false);
    expect(isLegacyV1Dump({ Exercise: 'not rows' })).toBe(false);
  });
});

describe('toLegacySqlValue', () => {
  it('keeps the types the 1.x database returned', () => {
    expect(toLegacySqlValue('80.5')).toBe('80.5');
    expect(toLegacySqlValue(80.5)).toBe(80.5);
    expect(toLegacySqlValue(null)).toBeNull();
    expect(toLegacySqlValue(undefined)).toBeNull();
  });

  it('converts what SQLite cannot store', () => {
    expect(toLegacySqlValue(true)).toBe(1);
    expect(toLegacySqlValue(false)).toBe(0);
    expect(toLegacySqlValue(Number.NaN)).toBeNull();
    expect(toLegacySqlValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe('planLegacyV1Tables', () => {
  it('plans every table the migration reads, empty when the dump lacks it', () => {
    const plans = planLegacyV1Tables({ Exercise: [{ id: 1, name: 'Squat' }] });

    expect(plans.map((plan) => plan.table)).toEqual([...LEGACY_V1_TABLES]);
    expect(plans.find((plan) => plan.table === 'User')?.rows).toEqual([]);
  });

  // The migration's WHERE / ORDER BY / JOIN clauses name these; a backup whose rows lack
  // them must still produce a table the queries can run against.
  it('always declares the columns the migration queries by', () => {
    const set = planLegacyV1Tables({}).find((plan) => plan.table === 'Set');

    expect(set?.columns).toEqual(['id', 'deletedAt', 'workoutId', 'setOrder']);
  });

  it('unions the columns of every row and fills the gaps with null', () => {
    const exercise = planLegacyV1Tables({
      Exercise: [
        { id: 1, name: 'Squat' },
        { id: 2, image: 'x.png' },
      ],
    }).find((plan) => plan.table === 'Exercise');

    expect(exercise?.columns).toEqual(['id', 'deletedAt', 'name', 'image']);
    expect(exercise?.rows).toEqual([
      [1, null, 'Squat', null],
      [2, null, null, 'x.png'],
    ]);
  });

  it('skips entries that are not rows', () => {
    const user = planLegacyV1Tables({ User: [null, 'x', { id: 1 }] as never }).find(
      (plan) => plan.table === 'User'
    );

    expect(user?.rows).toEqual([[1, null]]);
  });
});

describe('legacy SQL', () => {
  it('quotes identifiers taken from the backup', () => {
    expect(quoteSqlIdentifier('a"b')).toBe('"a""b"');
  });

  it('builds the create and insert statements', () => {
    const [plan] = planLegacyV1Tables({ FitnessGoals: [{ id: 1, calories: 2000 }] });

    expect(legacyCreateTableSql(plan)).toBe(
      'CREATE TABLE "FitnessGoals" ("id", "deletedAt", "calories");'
    );
    expect(legacyInsertSql(plan)).toBe(
      'INSERT INTO "FitnessGoals" ("id", "deletedAt", "calories") VALUES (?, ?, ?);'
    );
  });
});
