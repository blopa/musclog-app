import { database } from '@/database/database-instance';
import { ScheduleRepository } from '@/database/repositories/ScheduleRepository';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, comparison: unknown) => ({
      clause: 'where',
      field,
      comparison,
    })),
    eq: jest.fn((value: unknown) => ({ op: 'eq', value })),
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: { get: jest.fn() },
}));

const mockDatabase = database as jest.Mocked<typeof database>;

const where = (field: string, comparison: unknown) => ({ clause: 'where', field, comparison });

function stubSchedulesCollection() {
  const builtQuery = { fetch: jest.fn(), observe: jest.fn() };
  const query = jest.fn(() => builtQuery);
  mockDatabase.get.mockReturnValue({ query } as any);
  return { query, builtQuery };
}

describe('ScheduleRepository.getForDay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('matches the requested weekday and excludes soft-deleted schedules', () => {
    const { query, builtQuery } = stubSchedulesCollection();

    const result = ScheduleRepository.getForDay('monday');

    expect(mockDatabase.get).toHaveBeenCalledWith('schedules');
    expect(query.mock.calls[0]).toEqual([
      where('day_of_week', 'monday'),
      where('deleted_at', { op: 'eq', value: null }),
    ]);
    expect(result).toBe(builtQuery);
  });

  // The weekday is the caller's raw string, so a typo/casing mismatch must narrow the
  // result rather than silently widening it — assert it is passed through verbatim.
  it('passes the weekday through verbatim without normalizing it', () => {
    const { query } = stubSchedulesCollection();

    ScheduleRepository.getForDay('Sunday');

    expect(query.mock.calls[0][0]).toEqual(where('day_of_week', 'Sunday'));
  });

  it('returns the Query lazily so callers can observe instead of fetch', () => {
    const { builtQuery } = stubSchedulesCollection();

    ScheduleRepository.getForDay('friday');

    expect(builtQuery.fetch).not.toHaveBeenCalled();
    expect(builtQuery.observe).not.toHaveBeenCalled();
  });
});
