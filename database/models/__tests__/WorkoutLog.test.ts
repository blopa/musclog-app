import WorkoutLog from '@/database/models/WorkoutLog';
import { calculateWorkoutVolume } from '@/utils/workoutCalculator';

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

const mockCalculateWorkoutVolume = calculateWorkoutVolume as jest.MockedFunction<
  typeof calculateWorkoutVolume
>;

function updatable<T extends Record<string, unknown>>(fields: T): T & { prepareUpdate: jest.Mock } {
  const record = fields as T & { prepareUpdate: jest.Mock };
  record.prepareUpdate = jest.fn((callback) => {
    callback(record);
    return record;
  });
  return record;
}

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

describe('WorkoutLog completion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('calculates volume from submitted sets only', async () => {
    const loggedSet = {
      logExerciseId: 'log-exercise-1',
      difficultyLevel: 7,
      weight: 80,
      reps: 8,
      repsInReserve: 2,
    };
    const templatePlaceholder = {
      logExerciseId: 'log-exercise-1',
      difficultyLevel: 0,
      weight: 100,
      reps: 10,
      repsInReserve: 0,
    };
    const log: any = Object.assign(Object.create(WorkoutLog.prototype), {
      logExercises: {
        fetch: jest
          .fn()
          .mockResolvedValue([{ id: 'log-exercise-1', exerciseId: 'exercise-1', deletedAt: null }]),
      },
      collections: {
        get: jest.fn().mockReturnValue({
          query: jest.fn().mockReturnValue({
            fetch: jest.fn().mockResolvedValue([{ id: 'exercise-1', equipmentType: 'barbell' }]),
          }),
        }),
      },
      getAllSets: jest.fn().mockResolvedValue([loggedSet, templatePlaceholder]),
    });
    mockCalculateWorkoutVolume.mockReturnValue(123);

    await expect(log.calculateVolume(75)).resolves.toBe(123);

    expect(mockCalculateWorkoutVolume).toHaveBeenCalledWith(
      [
        {
          exercise: { equipmentType: 'barbell' },
          sets: [{ weight: 80, reps: 8, repsInReserve: 2 }],
        },
      ],
      75
    );
  });

  it('soft-deletes every unsubmitted set and exercise block when finishing early', async () => {
    const performedExercise = updatable({ id: 'performed-exercise', deletedAt: null });
    const untouchedExercise = updatable({ id: 'untouched-exercise', deletedAt: null });
    const skippedExercise = updatable({ id: 'skipped-exercise', deletedAt: null });
    const performedSet = updatable({
      id: 'performed-set',
      logExerciseId: performedExercise.id,
      difficultyLevel: 8,
      isSkipped: false,
    });
    const leftoverSetInPerformedExercise = updatable({
      id: 'leftover-set',
      logExerciseId: performedExercise.id,
      difficultyLevel: 0,
      isSkipped: false,
    });
    const untouchedSet = updatable({
      id: 'untouched-set',
      logExerciseId: untouchedExercise.id,
      difficultyLevel: 0,
      isSkipped: false,
    });
    const skippedSet = updatable({
      id: 'skipped-set',
      logExerciseId: skippedExercise.id,
      difficultyLevel: 0,
      isSkipped: true,
    });
    const batch = jest.fn().mockResolvedValue(undefined);
    const log: any = Object.assign(Object.create(WorkoutLog.prototype), {
      completedAt: undefined,
      logExercises: {
        fetch: jest.fn().mockResolvedValue([performedExercise, untouchedExercise, skippedExercise]),
      },
      collection: { database: { batch } },
      getAllSets: jest
        .fn()
        .mockResolvedValue([
          performedSet,
          leftoverSetInPerformedExercise,
          untouchedSet,
          skippedSet,
        ]),
      calculateVolume: jest.fn().mockResolvedValue(456),
    });
    log.prepareUpdate = jest.fn((callback) => {
      callback(log);
      return log;
    });
    jest.spyOn(Date, 'now').mockReturnValue(999);

    await log.completeWorkout(75);

    expect(performedSet.prepareUpdate).not.toHaveBeenCalled();
    expect(performedExercise.prepareUpdate).not.toHaveBeenCalled();
    expect(leftoverSetInPerformedExercise.deletedAt).toBe(999);
    expect(untouchedSet.deletedAt).toBe(999);
    expect(skippedSet.deletedAt).toBe(999);
    expect(untouchedExercise.deletedAt).toBe(999);
    expect(skippedExercise.deletedAt).toBe(999);
    expect(log.completedAt).toBe(999);
    expect(log.totalVolume).toBe(456);
    expect(batch).toHaveBeenCalledWith(
      leftoverSetInPerformedExercise,
      untouchedSet,
      skippedSet,
      untouchedExercise,
      skippedExercise,
      log
    );
  });
});
