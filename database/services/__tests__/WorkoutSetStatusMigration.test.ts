import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { WorkoutSetStatusMigration } from '@/database/services/WorkoutSetStatusMigration';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    eq: jest.fn((value) => value),
    oneOf: jest.fn((value) => value),
    or: jest.fn((...conditions) => conditions),
    take: jest.fn((value) => value),
    where: jest.fn((field, condition) => ({ field, condition })),
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: {
    batch: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    write: jest.fn((callback) => callback()),
  },
}));

const prepareUpdate = <T extends Record<string, unknown>>(record: T) => {
  Object.assign(record, {
    prepareUpdate: jest.fn((callback: (value: T) => void) => {
      callback(record);
      return record;
    }),
  });
  return record as T & { prepareUpdate: jest.Mock };
};

describe('WorkoutSetStatusMigration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('backfills legacy rows in a bounded batch and invalidates affected volume totals', async () => {
    const templateWorkout = prepareUpdate({
      id: 'template-workout',
      completedAt: 1,
      templateId: 'template-1',
      totalVolume: 900,
      updatedAt: 0,
    });
    const importedWorkout = prepareUpdate({
      id: 'imported-workout',
      completedAt: 1,
      templateId: undefined,
      totalVolume: 800,
      updatedAt: 0,
    });
    const activeWorkout = prepareUpdate({
      id: 'active-workout',
      completedAt: undefined,
      templateId: 'template-2',
      totalVolume: undefined,
      updatedAt: 0,
    });
    const sets = [
      prepareUpdate({
        id: 'placeholder',
        logExerciseId: 'template-exercise',
        difficultyLevel: 0,
        legacyIsSkipped: false,
        completionStatus: undefined,
        updatedAt: 0,
      }),
      prepareUpdate({
        id: 'imported',
        logExerciseId: 'imported-exercise',
        difficultyLevel: 0,
        legacyIsSkipped: false,
        completionStatus: undefined,
        updatedAt: 0,
      }),
      prepareUpdate({
        id: 'active',
        logExerciseId: 'active-exercise',
        difficultyLevel: 0,
        legacyIsSkipped: false,
        completionStatus: undefined,
        updatedAt: 0,
      }),
    ];
    const setFetch = jest.fn().mockResolvedValueOnce(sets).mockResolvedValueOnce([]);
    const rowsByTable: Record<string, unknown[]> = {
      workout_log_exercises: [
        { id: 'template-exercise', workoutLogId: templateWorkout.id },
        { id: 'imported-exercise', workoutLogId: importedWorkout.id },
        { id: 'active-exercise', workoutLogId: activeWorkout.id },
      ],
      workout_logs: [templateWorkout, importedWorkout, activeWorkout],
    };
    jest.mocked(database.get).mockImplementation(
      (table: string) =>
        ({
          query: jest.fn(() => ({
            fetch:
              table === 'workout_log_sets' ? setFetch : jest.fn(async () => rowsByTable[table]),
          })),
        }) as never
    );
    jest.spyOn(Date, 'now').mockReturnValue(123);

    await WorkoutSetStatusMigration.run();

    expect(Q.take).toHaveBeenCalledWith(200);
    expect(setFetch).toHaveBeenCalledTimes(2);
    expect(sets.map((set) => set.completionStatus)).toEqual(['skipped', 'performed', 'planned']);
    expect(sets.map((set) => set.difficultyLevel)).toEqual([undefined, undefined, undefined]);
    expect(templateWorkout.totalVolume).toBeUndefined();
    expect(templateWorkout.updatedAt).toBe(123);
    expect(importedWorkout.totalVolume).toBe(800);
    expect(activeWorkout.totalVolume).toBeUndefined();
    expect(database.batch).toHaveBeenCalledTimes(1);
  });
});
