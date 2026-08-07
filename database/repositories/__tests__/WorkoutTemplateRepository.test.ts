import { database } from '@/database/database-instance';
import { WorkoutTemplateRepository } from '@/database/repositories/WorkoutTemplateRepository';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, comparison: unknown) => ({
      clause: 'where',
      field,
      comparison,
    })),
    eq: jest.fn((value: unknown) => ({ op: 'eq', value })),
    sortBy: jest.fn((field: string, direction: string) => ({ clause: 'sortBy', field, direction })),
    asc: 'asc',
    desc: 'desc',
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: { get: jest.fn() },
}));

const mockDatabase = database as jest.Mocked<typeof database>;

const eq = (value: unknown) => ({ op: 'eq', value });
const where = (field: string, comparison: unknown) => ({ clause: 'where', field, comparison });
const sortBy = (field: string, direction: string) => ({ clause: 'sortBy', field, direction });

function stubTemplatesCollection() {
  const builtQuery = { fetch: jest.fn(), observe: jest.fn() };
  const query = jest.fn(() => builtQuery);
  mockDatabase.get.mockReturnValue({ query } as any);
  return { query, builtQuery };
}

const clausesOf = (query: jest.Mock) => query.mock.calls[0];

describe('WorkoutTemplateRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getActive selects non-deleted, non-archived templates newest first', () => {
    const { query, builtQuery } = stubTemplatesCollection();

    const result = WorkoutTemplateRepository.getActive();

    expect(mockDatabase.get).toHaveBeenCalledWith('workout_templates');
    expect(clausesOf(query)).toEqual([
      where('deleted_at', eq(null)),
      where('is_archived', eq(false)),
      sortBy('created_at', 'desc'),
    ]);
    expect(result).toBe(builtQuery);
  });

  it('getArchived is the exact complement of getActive on is_archived', () => {
    const { query } = stubTemplatesCollection();

    WorkoutTemplateRepository.getArchived();

    expect(clausesOf(query)).toEqual([
      where('deleted_at', eq(null)),
      where('is_archived', eq(true)),
      sortBy('created_at', 'desc'),
    ]);
  });

  // getAll is deliberately archive-agnostic: it backs surfaces that must still resolve a
  // template the user has archived (e.g. an old workout log pointing at it). Adding an
  // is_archived clause here would make those references dangle.
  it('getAll includes archived templates and only filters soft-deleted rows', () => {
    const { query } = stubTemplatesCollection();

    WorkoutTemplateRepository.getAll();

    expect(clausesOf(query)).toEqual([where('deleted_at', eq(null)), sortBy('created_at', 'desc')]);
    expect(clausesOf(query)).not.toContainEqual(where('is_archived', eq(false)));
    expect(clausesOf(query)).not.toContainEqual(where('is_archived', eq(true)));
  });

  it('every accessor excludes soft-deleted templates and sorts newest first', () => {
    for (const accessor of [
      WorkoutTemplateRepository.getActive,
      WorkoutTemplateRepository.getAll,
      WorkoutTemplateRepository.getArchived,
    ]) {
      jest.clearAllMocks();
      const { query } = stubTemplatesCollection();

      accessor.call(WorkoutTemplateRepository);

      expect(clausesOf(query)).toContainEqual(where('deleted_at', eq(null)));
      expect(clausesOf(query)).toContainEqual(sortBy('created_at', 'desc'));
    }
  });

  it('returns the Query lazily so callers can observe instead of fetch', () => {
    const { builtQuery } = stubTemplatesCollection();

    WorkoutTemplateRepository.getActive();

    expect(builtQuery.fetch).not.toHaveBeenCalled();
    expect(builtQuery.observe).not.toHaveBeenCalled();
  });
});
