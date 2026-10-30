import { database } from '@/database/database-instance';
import { ActivityRepository } from '@/database/repositories/ActivityRepository';
import { FastedDayRepository } from '@/database/repositories/FastedDayRepository';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => value),
    notEq: jest.fn((value: unknown) => ({ notEq: value })),
    sortBy: jest.fn((field: string, direction: string) => ({ kind: 'sortBy', field, direction })),
    take: jest.fn((count: number) => ({ kind: 'take', count })),
    desc: 'desc',
  },
}));

jest.mock('@/database/database-instance', () => ({ database: { get: jest.fn() } }));
jest.mock('@/database/repositories/FastedDayRepository', () => ({
  FastedDayRepository: { getAllFastedDayKeys: jest.fn() },
}));

function mockTables(rows: Record<string, unknown[]>) {
  const queries: Record<string, unknown[]> = {};
  (database.get as jest.Mock).mockImplementation((table: string) => ({
    query: (...clauses: unknown[]) => {
      queries[table] = clauses;
      return { fetch: async () => rows[table] ?? [] };
    },
  }));

  return queries;
}

describe('ActivityRepository.lastActivity', () => {
  beforeEach(() => {
    (FastedDayRepository.getAllFastedDayKeys as jest.Mock).mockResolvedValue(new Set<number>());
  });

  it('reports null for an area the person never used', async () => {
    mockTables({});

    expect(await ActivityRepository.lastActivity()).toEqual({
      lastWorkoutAt: null,
      lastFoodAt: null,
      lastWeighInAt: null,
    });
  });

  it('reads the newest completed workout, food log and weigh-in with one row each', async () => {
    const queries = mockTables({
      workout_logs: [{ completedAt: 1_000 }],
      nutrition_logs: [{ date: 2_000 }],
      user_metrics: [{ date: 3_000 }],
    });

    expect(await ActivityRepository.lastActivity()).toEqual({
      lastWorkoutAt: 1_000,
      lastFoodAt: 2_000,
      lastWeighInAt: 3_000,
    });
    // Every query is a single indexed row, never a scan.
    for (const clauses of Object.values(queries)) {
      expect(clauses).toContainEqual({ kind: 'take', count: 1 });
    }
    expect(queries.workout_logs).toContainEqual({
      field: 'completed_at',
      condition: { notEq: null },
    });
  });

  it('counts a flagged fasting day as food activity when it is newer than the last log', async () => {
    const fastDay = new Date(2026, 8, 10).getTime();
    (FastedDayRepository.getAllFastedDayKeys as jest.Mock).mockResolvedValue(
      new Set([Date.UTC(2026, 8, 3), Date.UTC(2026, 8, 10)])
    );
    mockTables({ nutrition_logs: [{ date: new Date(2026, 8, 5).getTime() }] });

    const result = await ActivityRepository.lastActivity();

    // The key is a UTC-normalised day; it comes back as that calendar day, local midnight.
    expect(new Date(result.lastFoodAt!).getDate()).toBe(new Date(fastDay).getDate());
    expect(result.lastFoodAt!).toBeGreaterThan(new Date(2026, 8, 5).getTime());
  });

  it('keeps the food log when it is newer than every fasting day', async () => {
    (FastedDayRepository.getAllFastedDayKeys as jest.Mock).mockResolvedValue(
      new Set([Date.UTC(2026, 8, 3)])
    );
    const logAt = new Date(2026, 8, 20, 12).getTime();
    mockTables({ nutrition_logs: [{ date: logAt }] });

    expect((await ActivityRepository.lastActivity()).lastFoodAt).toBe(logAt);
  });
});
