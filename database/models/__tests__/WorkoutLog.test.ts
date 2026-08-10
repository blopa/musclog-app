import WorkoutLog from '@/database/models/WorkoutLog';

jest.mock('@nozbe/watermelondb', () => ({
  Model: class {},
  Q: { eq: jest.fn(), oneOf: jest.fn(), where: jest.fn() },
}));
jest.mock('@nozbe/watermelondb/decorators', () => ({
  children: jest.fn(() => jest.fn()),
  field: jest.fn(() => jest.fn()),
  relation: jest.fn(() => jest.fn()),
  writer: jest.fn((_target, _property, descriptor) => descriptor),
}));
jest.mock('@/database/models/Exercise', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/WorkoutLogExercise', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/WorkoutLogSet', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/WorkoutPlan', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/WorkoutTemplate', () => ({ __esModule: true, default: class {} }));
jest.mock('@/utils/workoutCalculator', () => ({ calculateWorkoutVolume: jest.fn() }));

/**
 * `WorkoutLog` shipped without this override in 2.10.5, so `markAsDeleted` fell through to
 * WatermelonDB's base implementation — a Sync tombstone that is not a `@writer`, which made
 * `WorkoutService.deleteWorkoutLog`'s `callWriter` throw on every delete. The repo-wide
 * contract is pinned in `markAsDeleted.test.ts`; this pins what the override actually writes.
 */
describe('WorkoutLog.markAsDeleted', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stamps deleted_at and updated_at, and leaves the cascade to the service', async () => {
    const log: any = Object.assign(Object.create(WorkoutLog.prototype), {
      logExercises: { fetch: jest.fn() },
    });
    log.update = jest.fn((callback) => {
      callback(log);
      return Promise.resolve();
    });
    jest.spyOn(Date, 'now').mockReturnValue(456);

    await log.markAsDeleted();

    expect(log.deletedAt).toBe(456);
    expect(log.updatedAt).toBe(456);
    // Exercises and sets are soft-deleted by `WorkoutService.deleteWorkoutLog`, which also
    // cleans up the BLE data-point files — doing it here too would double up.
    expect(log.logExercises.fetch).not.toHaveBeenCalled();
  });
});
