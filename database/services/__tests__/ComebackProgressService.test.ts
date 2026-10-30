import { database } from '@/database/database-instance';
import { ComebackProgressService } from '@/database/services/ComebackProgressService';
import { DEFAULT_COMEBACK_STATE, type ComebackState } from '@/utils/comeback/comebackState';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => value),
    gte: jest.fn((value: unknown) => ({ gte: value })),
    between: jest.fn((from: number, to: number) => ({ from, to })),
    sortBy: jest.fn((field: string, direction: string) => ({ field, direction })),
    asc: 'asc',
  },
}));
jest.mock('@/database/database-instance', () => ({ database: { get: jest.fn() } }));

const DAY = 86_400_000;
const startedAt = new Date(2026, 8, 1).getTime();
const now = startedAt + 20 * DAY;

const state = (patch: Partial<ComebackState> = {}): ComebackState => ({
  ...DEFAULT_COMEBACK_STATE,
  status: 'active',
  startedAt,
  ...patch,
});

const weigh = (kg: number, date: number, unit = 'kg') => ({
  date,
  getDecrypted: async () => ({ value: kg, unit }),
});

function mockTables(tables: {
  workoutCount?: number;
  workouts?: { completedAt: number }[];
  food?: { date: number }[];
  weights?: ReturnType<typeof weigh>[];
}) {
  (database.get as jest.Mock).mockImplementation((table: string) => ({
    query: () => ({
      fetchCount: async () => tables.workoutCount ?? 0,
      fetch: async () => {
        if (table === 'workout_logs') {
          return tables.workouts ?? [];
        }

        return table === 'nutrition_logs' ? (tables.food ?? []) : (tables.weights ?? []);
      },
    }),
  }));
}

describe('ComebackProgressService.summarize', () => {
  it('has nothing before a comeback starts', async () => {
    mockTables({});

    expect(await ComebackProgressService.summarize(DEFAULT_COMEBACK_STATE, now)).toEqual({
      workouts: 0,
      foodDays: 0,
      minimumDays: 0,
      weight: null,
    });
  });

  it('counts workouts, distinct food days and minimum days since day 1', async () => {
    mockTables({
      workoutCount: 5,
      food: [
        { date: startedAt + 3 * DAY },
        { date: startedAt + 3 * DAY + 3_600_000 },
        { date: startedAt + 4 * DAY },
      ],
    });

    const progress = await ComebackProgressService.summarize(
      state({ minimumDays: ['2026-08-20', '2026-09-03', '2026-09-05'] }),
      now
    );

    expect(progress.workouts).toBe(5);
    expect(progress.foodDays).toBe(2);
    // A minimum day logged before day 1 belongs to an earlier attempt.
    expect(progress.minimumDays).toBe(2);
  });

  it('compares the recent average with the weight at day 1', async () => {
    mockTables({
      weights: [
        weigh(82, startedAt),
        weigh(81, startedAt + 5 * DAY),
        weigh(80.4, now - 3 * DAY),
        weigh(80.6, now - DAY),
      ],
    });

    const { weight } = await ComebackProgressService.summarize(state(), now);

    expect(weight?.startKg).toBe(82);
    expect(weight?.nowKg).toBeCloseTo(80.5, 5);
  });

  it('falls back to the latest weigh-in when nothing is recent, and converts pounds', async () => {
    mockTables({ weights: [weigh(180, startedAt, 'lbs'), weigh(176, startedAt + 6 * DAY, 'lbs')] });

    const { weight } = await ComebackProgressService.summarize(state(), now);

    expect(weight?.startKg).toBeCloseTo(81.65, 1);
    expect(weight?.nowKg).toBeCloseTo(79.83, 1);
  });

  it('has no weight comparison without a weigh-in near day 1', async () => {
    mockTables({ weights: [] });

    expect((await ComebackProgressService.summarize(state(), now)).weight).toBeNull();
  });
});

describe('ComebackProgressService.activeDaysThisWeek', () => {
  // Wednesday 14 Oct 2026, midday.
  const wednesday = new Date(2026, 9, 14, 12).getTime();

  it('counts the distinct days of this week the person trained, ate or did their minimum', async () => {
    mockTables({
      workouts: [{ completedAt: new Date(2026, 9, 12, 18).getTime() }],
      food: [{ date: new Date(2026, 9, 13, 12).getTime() }],
    });

    expect(
      await ComebackProgressService.activeDaysThisWeek(
        state({ minimumDays: ['2026-10-14', '2026-10-05'] }),
        wednesday
      )
    ).toBe(3);
  });

  it('is zero in a week with nothing logged', async () => {
    mockTables({});

    expect(await ComebackProgressService.activeDaysThisWeek(state(), wednesday)).toBe(0);
  });
});
