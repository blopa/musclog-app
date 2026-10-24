/** Module mocks shared by the WorkoutAnalytics suites. Import FIRST so they register before the service loads. */
/**
 * The `Q` stub keeps the operator alongside the value so `queryFixture()` below can
 * actually evaluate a query instead of relying on call ordering. `Q.eq(null)` and
 * `Q.notEq(null)` are otherwise indistinguishable once evaluated.
 */
jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => ({ op: 'eq', value })),
    notEq: jest.fn((value: any) => ({ op: 'notEq', value })),
    gte: jest.fn((value: any) => ({ op: 'gte', value })),
    lte: jest.fn((value: any) => ({ op: 'lte', value })),
    lt: jest.fn((value: any) => ({ op: 'lt', value })),
    oneOf: jest.fn((values: any[]) => ({ op: 'oneOf', values })),
    sortBy: jest.fn((field: string, direction: any) => ({ sortByField: field, direction })),
    take: jest.fn((count: number) => ({ takeCount: count })),
    asc: 'asc' as const,
    desc: 'desc' as const,
  },
}));

// Modules further down the graph still reach the database through the `database/index`
// barrel; loading it for real would evaluate every WatermelonDB model against the `Q`-only
// mock above (`class X extends Model` with `Model` undefined), so point it at the same
// mocked instance.
jest.mock('../../index', () => require('../../database-instance'));

jest.mock('../../database-instance', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn((callback) => Promise.resolve(callback({} as any))),
    batch: jest.fn().mockResolvedValue(undefined),
  },
}));

// `detectPersonalRecords` / `getProgressiveOverloadData` / `calculateMuscleGroupVolume` all
// resolve the user's bodyweight (for bodyweight-exercise volume) through UserMetricService,
// which decrypts a user_metrics row. None of these tests are about that lookup.
jest.mock('../UserMetricService', () => ({
  UserMetricService: {
    getUserBodyWeightKgForVolume: jest.fn().mockResolvedValue(0),
  },
}));

export {};
