import { database } from '@/database/database-instance';
import { WorkoutLogRepository } from '@/database/repositories/WorkoutLogRepository';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, comparison: unknown) => ({
      clause: 'where',
      field,
      comparison,
    })),
    eq: jest.fn((value: unknown) => ({ op: 'eq', value })),
    notEq: jest.fn((value: unknown) => ({ op: 'notEq', value })),
    gte: jest.fn((value: unknown) => ({ op: 'gte', value })),
    lte: jest.fn((value: unknown) => ({ op: 'lte', value })),
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
const notEq = (value: unknown) => ({ op: 'notEq', value });
const where = (field: string, comparison: unknown) => ({ clause: 'where', field, comparison });
const sortBy = (field: string, direction: string) => ({ clause: 'sortBy', field, direction });

/** Collection stub whose `.query()` returns a base query that `.extend()`s into a distinct object. */
function stubWorkoutLogsCollection() {
  const extendedQuery = { tag: 'extended', fetch: jest.fn() };
  const baseQuery = { tag: 'base', extend: jest.fn(() => extendedQuery), fetch: jest.fn() };
  const query = jest.fn(() => baseQuery);
  mockDatabase.get.mockReturnValue({ query } as any);
  return { query, baseQuery, extendedQuery };
}

describe('WorkoutLogRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getActive', () => {
    it('selects only in-progress, non-deleted logs, newest start first', () => {
      const { query, baseQuery } = stubWorkoutLogsCollection();

      const result = WorkoutLogRepository.getActive();

      expect(mockDatabase.get).toHaveBeenCalledWith('workout_logs');
      expect(query.mock.calls[0]).toEqual([
        where('completed_at', eq(null)),
        where('deleted_at', eq(null)),
        sortBy('started_at', 'desc'),
      ]);
      expect(result).toBe(baseQuery);
    });

    // An active log is defined by a null completed_at; a soft-deleted in-progress log
    // must never resurface as "the workout you're currently doing".
    it('excludes soft-deleted logs even though they are still in progress', () => {
      const { query } = stubWorkoutLogsCollection();

      WorkoutLogRepository.getActive();

      expect(query.mock.calls[0]).toContainEqual(where('deleted_at', eq(null)));
    });

    it('returns the Query lazily so callers can observe instead of fetch', () => {
      const { baseQuery } = stubWorkoutLogsCollection();

      WorkoutLogRepository.getActive();

      expect(baseQuery.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getCompleted', () => {
    it('selects only finished, non-deleted logs, newest start first', () => {
      const { query, baseQuery } = stubWorkoutLogsCollection();

      const result = WorkoutLogRepository.getCompleted();

      expect(mockDatabase.get).toHaveBeenCalledWith('workout_logs');
      expect(query.mock.calls[0]).toEqual([
        where('completed_at', notEq(null)),
        where('deleted_at', eq(null)),
        sortBy('started_at', 'desc'),
      ]);
      expect(baseQuery.extend).not.toHaveBeenCalled();
      expect(result).toBe(baseQuery);
    });

    it('windows by started_at with an inclusive range when a timeframe is given', () => {
      const { baseQuery } = stubWorkoutLogsCollection();

      WorkoutLogRepository.getCompleted({ startDate: 1_000, endDate: 2_000 });

      expect(baseQuery.extend).toHaveBeenCalledWith(
        where('started_at', { op: 'gte', value: 1_000 }),
        where('started_at', { op: 'lte', value: 2_000 })
      );
    });

    // `Query.extend()` returns a NEW query rather than mutating in place — dropping the
    // returned value would silently hand back every completed log, ignoring the timeframe.
    it('returns the extended query, not the unbounded base query', () => {
      const { baseQuery, extendedQuery } = stubWorkoutLogsCollection();

      const result = WorkoutLogRepository.getCompleted({ startDate: 1_000, endDate: 2_000 });

      expect(result).toBe(extendedQuery);
      expect(result).not.toBe(baseQuery);
    });

    // The completed/deleted/sort clauses must survive the extend, otherwise a timeframed
    // history read would start including in-progress or deleted workouts.
    it('keeps the base clauses when extending with a timeframe', () => {
      const { query } = stubWorkoutLogsCollection();

      WorkoutLogRepository.getCompleted({ startDate: 1_000, endDate: 2_000 });

      expect(query.mock.calls[0]).toEqual([
        where('completed_at', notEq(null)),
        where('deleted_at', eq(null)),
        sortBy('started_at', 'desc'),
      ]);
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('still windows on a zero-width timeframe rather than falling back to unbounded', () => {
      const { baseQuery, extendedQuery } = stubWorkoutLogsCollection();

      const result = WorkoutLogRepository.getCompleted({ startDate: 0, endDate: 0 });

      expect(baseQuery.extend).toHaveBeenCalledWith(
        where('started_at', { op: 'gte', value: 0 }),
        where('started_at', { op: 'lte', value: 0 })
      );
      expect(result).toBe(extendedQuery);
    });
  });
});
