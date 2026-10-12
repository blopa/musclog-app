import { database } from '@/database/database-instance';
import { CardioLogService } from '@/database/services/CardioLogService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => value),
    notEq: jest.fn((value: any) => value),
    gte: jest.fn((value: any) => value),
    lte: jest.fn((value: any) => value),
    oneOf: jest.fn((values: any[]) => values),
    sortBy: jest.fn((field: string, direction: any) => ({ field, direction })),
    take: jest.fn((count: number) => count),
    skip: jest.fn((count: number) => count),
    desc: 'desc' as const,
    asc: 'asc' as const,
  },
}));

// Modules further down the graph still reach the database through the `database/index`
// barrel; loading it for real would evaluate every WatermelonDB model against the `Q`-only
// mock above (`class X extends Model` with `Model` undefined), so point it at the same
// mocked instance.
jest.mock('../../index', () => require('../../database-instance'));

jest.mock('../../database-instance', () => {
  const mockQuery = {
    fetch: jest.fn().mockResolvedValue([]),
    extend: jest.fn().mockReturnThis(),
  };

  const mockCollection = {
    query: jest.fn().mockReturnValue(mockQuery),
    find: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    prepareCreate: jest.fn().mockReturnValue({}),
    fetch: jest.fn().mockResolvedValue([]),
  };

  // Model `markAsDeleted` methods are `@writer`s, so a service holding an open write block
  // has to reach them through `writer.callWriter`. Real WatermelonDB throws
  // "callReader/callWriter call must call a reader/writer synchronously" when the callback
  // is not a writer, and deadlocks when a writer is called without it — neither is
  // observable through a bare `{}` writer, so expose the spy and let tests assert on it.
  const mockCallWriter = jest.fn((work: () => unknown) => Promise.resolve(work()));
  const mockWriter = { callWriter: mockCallWriter } as any;

  return {
    database: {
      get: jest.fn().mockReturnValue(mockCollection),
      write: jest.fn((callback) => Promise.resolve(callback(mockWriter))),
      batch: jest.fn().mockResolvedValue(undefined),
      collections: {
        get: jest.fn().mockReturnValue(mockCollection),
      },
    },
    __callWriter: mockCallWriter,
  };
});

jest.mock('../UserMetricService', () => ({
  UserMetricService: {
    getLatest: jest.fn().mockResolvedValue(null),
    getUserBodyWeightKgForVolume: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock('@/services/healthConnectWorkout', () => ({
  writeWorkoutToHealthConnect: jest.fn().mockResolvedValue(undefined),
}));

const mockDatabase = database as jest.Mocked<typeof database>;

/**
 * A collection stub that always answers both `find` and `query`. The service makes
 * incidental lookups around the call under test (calorie estimate, health sync); those
 * are caught and ignored by the service, but only if the collection responds at all.
 */
const collection = (overrides: { fetch?: jest.Mock; find?: jest.Mock } = {}) => ({
  create: jest.fn().mockResolvedValue({}),
  find: overrides.find ?? jest.fn().mockResolvedValue(null),
  prepareCreate: jest.fn().mockReturnValue({}),
  query: jest.fn().mockReturnValue({
    extend: jest.fn().mockReturnThis(),
    fetch: overrides.fetch ?? jest.fn().mockResolvedValue([]),
  }),
});

describe('CardioLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearAllMocks` does not drain a `mockReturnValueOnce` queue, so a test that queues
    // more collections than the service consumes would leak into the next one.
    mockDatabase.get.mockReset();
    mockDatabase.get.mockReturnValue(collection() as any);
  });

  describe('logCardioSession', () => {
    const { UserMetricService } = jest.requireMock('../UserMetricService') as {
      UserMetricService: { getUserBodyWeightKgForVolume: jest.Mock };
    };
    const { writeWorkoutToHealthConnect } = jest.requireMock('@/services/healthConnectWorkout') as {
      writeWorkoutToHealthConnect: jest.Mock;
    };

    /** Records what `prepareCreate` was asked to build, keyed by table. */
    function captureCreates() {
      const created: Record<string, any[]> = {};
      mockDatabase.get.mockImplementation((table: string) => {
        return {
          ...collection(),
          prepareCreate: jest.fn((builder: (record: any) => void) => {
            const record: any = { id: `${table}-${(created[table]?.length ?? 0) + 1}` };
            builder(record);
            record.update = jest.fn(async (updater: (r: any) => void) => updater(record));
            (created[table] ??= []).push(record);
            return record;
          }),
        } as any;
      });
      return created;
    }

    const base = {
      activity: 'run' as const,
      distanceM: 5000,
      durationS: 1800,
      endedAt: 1_700_000_000_000,
      workoutName: 'Run',
    };

    beforeEach(() => {
      UserMetricService.getUserBodyWeightKgForVolume.mockResolvedValue(70);
      writeWorkoutToHealthConnect.mockClear();
    });

    it('writes one completed cardio log and one exercise, and NO sets, in a single batch', async () => {
      const created = captureCreates();

      await CardioLogService.logCardioSession(base);

      expect(created.workout_logs).toHaveLength(1);
      expect(created.workout_log_exercises).toHaveLength(1);
      expect(created.workout_log_sets).toBeUndefined();
      // One writer for the whole log; a second write happens only to stamp a health record id.
      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      expect(mockDatabase.batch).toHaveBeenCalledWith(
        created.workout_logs[0],
        created.workout_log_exercises[0]
      );
    });

    it('stamps the activity, the distance and a window that ends where it was told to', async () => {
      const created = captureCreates();

      await CardioLogService.logCardioSession(base);

      expect(created.workout_logs[0]).toMatchObject({
        type: 'cardio',
        activity: 'run',
        distanceM: 5000,
        completedAt: base.endedAt,
        startedAt: base.endedAt - 1800 * 1000,
        totalVolume: 0,
        workoutName: 'Run',
        timezone: expect.any(String),
      });
    });

    it('estimates calories from body mass, and lets a watch figure win', async () => {
      let created = captureCreates();
      await CardioLogService.logCardioSession(base);
      expect(created.workout_logs[0].caloriesBurned).toBe(387);

      created = captureCreates();
      await CardioLogService.logCardioSession({ ...base, caloriesOverride: 450 });
      expect(created.workout_logs[0].caloriesBurned).toBe(450);
    });

    it('stores no calories at all when it cannot estimate them (no body weight yet)', async () => {
      UserMetricService.getUserBodyWeightKgForVolume.mockResolvedValue(0);
      const created = captureCreates();

      await CardioLogService.logCardioSession(base);

      expect(created.workout_logs[0].caloriesBurned).toBeUndefined();
    });

    it.each([
      [{ activity: 'walk' as const }, false, 'fx-Trail_Running_Walking'],
      [{ activity: 'run' as const }, false, 'fx-Trail_Running_Walking'],
      [{ activity: 'walk' as const }, true, 'fx-Walking_Treadmill'],
      [{ activity: 'run' as const }, true, 'fx-Running_Treadmill'],
    ])('points %p (treadmill: %p) at %s', async (override, treadmill, exerciseId) => {
      const created = captureCreates();

      await CardioLogService.logCardioSession({ ...base, ...override, treadmill });

      expect(created.workout_log_exercises[0].exerciseId).toBe(exerciseId);
    });

    it.each([
      ['no distance', { distanceM: 0 }],
      ['a negative distance', { distanceM: -5 }],
      ['no duration', { durationS: 0 }],
      ['more than a day', { durationS: 24 * 3600 + 1 }],
      ['an unknown activity', { activity: 'swim' as never }],
    ])('refuses %s before writing anything', async (_label, override) => {
      captureCreates();

      await expect(CardioLogService.logCardioSession({ ...base, ...override })).rejects.toThrow();

      expect(mockDatabase.write).not.toHaveBeenCalled();
    });

    it('hands the health write the activity and distance, and keeps its record id', async () => {
      const created = captureCreates();
      writeWorkoutToHealthConnect.mockResolvedValueOnce('hc-1');

      await CardioLogService.logCardioSession(base);

      expect(writeWorkoutToHealthConnect).toHaveBeenCalledWith(
        expect.objectContaining({ activity: 'run', distanceM: 5000, workoutType: 'cardio' })
      );
      expect(created.workout_logs[0].externalId).toBe('hc-1');
    });

    it('still returns the log when the health write fails', async () => {
      captureCreates();
      writeWorkoutToHealthConnect.mockRejectedValueOnce(new Error('no permission'));

      await expect(CardioLogService.logCardioSession(base)).resolves.toMatchObject({
        activity: 'run',
      });
    });
  });
});
