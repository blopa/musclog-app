import { ExerciseService } from '@/database/services/ExerciseService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: (field: string, condition: unknown) => ({ field, condition }),
    eq: (value: unknown) => value,
    sortBy: (field: string) => ({ kind: 'sortBy', field }),
    skip: (count: number) => ({ kind: 'skip', count }),
    take: (count: number) => ({ kind: 'take', count }),
    asc: 'asc',
  },
}));

jest.mock('@/database/models/Exercise', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/ExerciseAlias', () => ({ __esModule: true, default: class {} }));

const mockSearchCondition = { kind: 'search-condition-sentinel' };
jest.mock('@/database/exerciseSearchCondition', () => ({
  exerciseSearchCondition: jest.fn((term: string) =>
    term.replace(/[^a-z]/gi, '') ? mockSearchCondition : null
  ),
}));

jest.mock('@/data/exerciseCatalogue', () => ({
  getAllLocaleExerciseNamesBySlug: () => new Map(),
}));

jest.mock('@/database/database-instance', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    batch: jest.fn(async () => undefined),
  },
}));

const { database } = jest.requireMock('@/database/database-instance') as {
  database: { get: jest.Mock; write: jest.Mock; batch: jest.Mock };
};
const { exerciseSearchCondition } = jest.requireMock('@/database/exerciseSearchCondition') as {
  exerciseSearchCondition: jest.Mock;
};

function queryRecorder(rows: unknown[] = []) {
  const extend = jest.fn();
  const query: any = { extend, fetch: jest.fn(async () => rows) };
  extend.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ExerciseService search', () => {
  it('filters getExercisesPaginatedFiltered through the shared search condition', async () => {
    const query = queryRecorder();
    database.get.mockReturnValue({ query: jest.fn(() => query) });

    await ExerciseService.getExercisesPaginatedFiltered(20, 0, { searchTerm: 'db flys' });

    expect(exerciseSearchCondition).toHaveBeenCalledWith('db flys');
    expect(query.extend).toHaveBeenCalledWith(mockSearchCondition);
  });

  it('adds no search clause when the text has no searchable words', async () => {
    const query = queryRecorder();
    database.get.mockReturnValue({ query: jest.fn(() => query) });

    await ExerciseService.getExercisesPaginatedFiltered(20, 0, { searchTerm: '  %% ' });

    expect(query.extend).not.toHaveBeenCalledWith(mockSearchCondition);
  });

  it('searchExercises passes the condition into the query, not a raw name LIKE', async () => {
    const query = jest.fn(() => ({ fetch: jest.fn(async () => []) }));
    database.get.mockReturnValue({ query });

    await ExerciseService.searchExercises('rdl');

    expect(query.mock.calls[0] as unknown[]).toContain(mockSearchCondition);
  });
});

describe('ExerciseService search_text upkeep', () => {
  it('stamps search_text when an exercise is created', async () => {
    const record: any = { id: 'user-1' };
    database.get.mockReturnValue({
      create: jest.fn(async (builder: (r: any) => void) => {
        builder(record);
        return record;
      }),
    });

    await ExerciseService.createExercise('Cable Flyes', 'desc', 'chest', 'cable', 'isolation');

    expect(record.searchText.trim().split(' ').sort()).toEqual(['cable', 'fly', 'cablefly'].sort());
  });

  it('rebuilds search_text on rename, keeping the exercise aliases', async () => {
    const exercise: any = {
      id: 'user-1',
      name: 'Old',
      deletedAt: null,
      update: jest.fn(async (updater: (r: any) => void) => updater(exercise)),
    };
    database.get.mockImplementation((table: string) =>
      table === 'exercises'
        ? { find: jest.fn(async () => exercise) }
        : { query: jest.fn(() => ({ fetch: jest.fn(async () => [{ alias: 'Chest Fly Thing' }]) })) }
    );

    await ExerciseService.updateExercise('user-1', { name: 'Pec Deck' });

    expect(exercise.searchText.split(' ')).toEqual(
      expect.arrayContaining(['pec', 'deck', 'thing'])
    );
  });

  it('leaves search_text alone when the name does not change', async () => {
    const exercise: any = {
      id: 'user-1',
      name: 'Same',
      searchText: 'same',
      deletedAt: null,
      update: jest.fn(async (updater: (r: any) => void) => updater(exercise)),
    };
    database.get.mockReturnValue({ find: jest.fn(async () => exercise) });

    await ExerciseService.updateExercise('user-1', { description: 'new text' });

    expect(exercise.searchText).toBe('same');
  });
});

describe('ExerciseService.backfillSearchText', () => {
  function missingRow(id: string, name: string) {
    const row: any = { id, name, searchText: undefined, updatedAt: 7 };
    row.prepareUpdate = (updater: (r: any) => void) => {
      updater(row);
      return row;
    };
    return row;
  }

  it('fills only rows missing it, includes their aliases and leaves updated_at alone', async () => {
    const rows = [missingRow('user-1', 'Pec Deck'), missingRow('user-2', 'Plank')];
    database.get.mockImplementation((table: string) => ({
      query: jest.fn(() => ({
        fetch: jest.fn(async () =>
          table === 'exercises' ? rows : [{ exerciseId: 'user-2', alias: 'Front Bridge' }]
        ),
      })),
    }));

    expect(await ExerciseService.backfillSearchText()).toBe(2);

    expect(rows[0].searchText.split(' ')).toEqual(expect.arrayContaining(['pec', 'deck']));
    expect(rows[1].searchText.split(' ')).toEqual(expect.arrayContaining(['plank', 'bridge']));
    expect(rows.map((row) => row.updatedAt)).toEqual([7, 7]);
    expect(database.batch).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when every row already has search_text', async () => {
    database.get.mockReturnValue({ query: jest.fn(() => ({ fetch: jest.fn(async () => []) })) });

    expect(await ExerciseService.backfillSearchText()).toBe(0);
    expect(database.batch).not.toHaveBeenCalled();
  });

  it('splits a large library into bounded batches', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => missingRow(`user-${i}`, `Move ${i}`));
    database.get.mockImplementation((table: string) => ({
      query: jest.fn(() => ({ fetch: jest.fn(async () => (table === 'exercises' ? rows : [])) })),
    }));

    await ExerciseService.backfillSearchText();

    expect(database.batch.mock.calls.map((call) => call.length)).toEqual([500, 500, 200]);
  });
});
