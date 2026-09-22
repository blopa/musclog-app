import { database } from '@/database/database-instance';
import { fetchByIds, fetchMapByIds, MAX_QUERY_IDS } from '@/database/queryByIds';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => ({ kind: 'eq', value })),
    oneOf: jest.fn((values: unknown[]) => ({ kind: 'oneOf', values })),
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: { get: jest.fn() },
}));

const mockDatabase = database as jest.Mocked<typeof database>;

/** Returns the row for every id the query was handed, so chunking is observable. */
function wireCollection() {
  const fetch = jest.fn();
  const query = jest.fn((clause: any) => {
    const ids: string[] = clause.condition.values;
    fetch.mockResolvedValueOnce(ids.map((id) => ({ id })));
    return { fetch };
  });

  mockDatabase.get.mockReturnValue({ query } as any);
  return { query };
}

describe('fetchByIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issues no query at all for an empty id list', async () => {
    const { query } = wireCollection();

    await expect(fetchByIds('foods', 'id', [])).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('fetches a small id list in one query', async () => {
    const { query } = wireCollection();

    const rows = await fetchByIds('foods', 'id', ['a', 'b', 'c']);

    expect(query).toHaveBeenCalledTimes(1);
    expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('collapses duplicate ids before querying', async () => {
    const { query } = wireCollection();

    const rows = await fetchByIds('foods', 'id', ['a', 'a', 'b', 'a']);

    expect(query.mock.calls[0][0].condition.values).toEqual(['a', 'b']);
    expect(rows).toHaveLength(2);
  });

  it('splits a list past the bound-parameter limit across several queries', async () => {
    // An unchunked Q.oneOf here is the failure this helper exists to prevent: SQLite caps
    // bound parameters per statement, so a large cascade would throw rather than batch.
    const { query } = wireCollection();
    const ids = Array.from({ length: MAX_QUERY_IDS * 2 + 7 }, (_, index) => `id-${index}`);

    const rows = await fetchByIds('workout_log_sets', 'log_exercise_id', ids);

    expect(query).toHaveBeenCalledTimes(3);
    for (const call of query.mock.calls) {
      expect(call[0].condition.values.length).toBeLessThanOrEqual(MAX_QUERY_IDS);
    }
    expect(rows.map((row) => row.id)).toEqual(ids);
  });

  it('applies extra clauses to every chunk', async () => {
    const { query } = wireCollection();
    const deletedAtIsNull = { field: 'deleted_at', condition: { kind: 'eq', value: null } };
    const ids = Array.from({ length: MAX_QUERY_IDS + 1 }, (_, index) => `id-${index}`);

    await fetchByIds('foods', 'id', ids, deletedAtIsNull as never);

    expect(query).toHaveBeenCalledTimes(2);
    for (const call of query.mock.calls) {
      expect(call[1]).toEqual(deletedAtIsNull);
    }
  });
});

describe('fetchMapByIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keys the fetched rows by id', async () => {
    wireCollection();

    const byId = await fetchMapByIds('foods', 'id', ['a', 'b']);

    expect([...byId.keys()]).toEqual(['a', 'b']);
    expect(byId.get('a')).toEqual({ id: 'a' });
  });
});
