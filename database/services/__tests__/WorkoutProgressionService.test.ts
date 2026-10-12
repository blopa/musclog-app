import { database } from '@/database/database-instance';
import { GymService } from '@/database/services/GymService';
import { SettingsService } from '@/database/services/SettingsService';
import { WorkoutProgressionService } from '@/database/services/WorkoutProgressionService';
import { kgToDisplay } from '@/utils/unitConversion';

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

describe('WorkoutProgressionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearAllMocks` does not drain a `mockReturnValueOnce` queue, so a test that queues
    // more collections than the service consumes would leak into the next one.
    mockDatabase.get.mockReset();
    mockDatabase.get.mockReturnValue(collection() as any);
  });

  describe('start-of-workout progression', () => {
    const planned = (id: string, fields: Record<string, unknown> = {}) => {
      const row: any = {
        id,
        logExerciseId: 'le-bench',
        weight: 60,
        reps: 8,
        setOrder: 1,
        completionStatus: 'planned',
        setType: 'normal',
        adjustmentJson: undefined,
        deletedAt: null,
        ...fields,
      };
      row.prepareUpdate = jest.fn((updater: (draft: any) => void) => {
        updater(row);
        return row;
      });
      return row;
    };

    const bench = { id: 'bench', equipmentType: 'barbell', mechanicType: 'compound' };

    /**
     * Installs the tables `applyStartProgression` reads: this workout's log exercises and sets,
     * the exercise catalogue, and the previous session's log exercise + performed sets.
     */
    function installHistory(options: {
      sets: any[];
      previousSets?: any[];
      exercise?: Record<string, unknown>;
      userSettings?: any[];
      onHistoryRead?: () => void;
    }) {
      const previousLogExercise = { id: 'prev-le' };
      mockDatabase.get.mockImplementation((table: string) => {
        if (table === 'exercise_user_settings') {
          return collection({ fetch: jest.fn().mockResolvedValue(options.userSettings ?? []) });
        }
        if (table === 'workout_log_exercises') {
          // The same collection is read for this workout and for history; history is the one
          // filtered by `workout_log_id != this workout`, so tell them apart by the clauses.
          return {
            query: jest.fn((...clauses: any[]) => ({
              fetch: jest.fn(async () => {
                if (!clauses.some((c) => c?.field === 'exercise_id')) {
                  return [{ id: 'le-bench', exerciseId: 'bench' }];
                }
                options.onHistoryRead?.();
                return options.previousSets ? [previousLogExercise] : [];
              }),
            })),
          } as any;
        }
        if (table === 'workout_log_sets') {
          return {
            query: jest.fn((...clauses: any[]) => ({
              fetch: jest
                .fn()
                .mockResolvedValue(
                  clauses.some((c) => c?.field === 'log_exercise_id' && c.condition === 'prev-le')
                    ? (options.previousSets ?? [])
                    : options.sets
                ),
            })),
          } as any;
        }
        if (table === 'exercises') {
          return {
            query: jest.fn(() => ({
              fetch: jest.fn().mockResolvedValue([{ ...bench, ...options.exercise }]),
            })),
          } as any;
        }
        return collection() as any;
      });
    }

    /** Last session: `weight` kg for 8 reps, the given reps in reserve on every working set. */
    const lastSession = (weight: number, repsInReserve: number) => [
      { weight, reps: 8, repsInReserve, setOrder: 1 },
      { weight, reps: 8, repsInReserve, setOrder: 2 },
    ];

    beforeEach(() => {
      jest.spyOn(SettingsService, 'getWorkoutAutonomy').mockResolvedValue('suggest');
      jest.spyOn(SettingsService, 'getProgressionMode').mockResolvedValue('weight_first');
      jest.spyOn(SettingsService, 'getUnits').mockResolvedValue('metric');
      jest.spyOn(GymService, 'getActiveGym').mockResolvedValue(null);
    });
    afterEach(() => jest.restoreAllMocks());

    it('starts straight sets from how the last session went and records why', async () => {
      const sets = [
        planned('s1', { setOrder: 1 }),
        planned('s2', { setOrder: 2 }),
        planned('s3', { setOrder: 3 }),
      ];
      installHistory({ sets, previousSets: lastSession(62, 4) });

      const changed = await WorkoutProgressionService.applyStartProgression('wl-1');

      expect(changed).toBe(3);
      for (const set of sets) {
        expect(set.weight).toBe(65); // 62 + the 2.5 kg step, to a whole kilogram
        expect(set.reps).toBe(8);
        expect(JSON.parse(set.adjustmentJson)).toMatchObject({
          cause: 'progression',
          field: 'weight',
          from: 60,
          to: 65,
          plan: { weightKg: 60, reps: 8 },
          last: { weightKg: 62, reps: 8, averageRepsInReserve: 4 },
        });
      }
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    });

    it('progresses an exercise shown in pounds in whole pounds, even on a metric account', async () => {
      const sets = [planned('s1', { weight: 60 })];
      installHistory({
        sets,
        previousSets: lastSession(62, 4),
        userSettings: [{ exerciseId: 'bench', weightUnit: 'lbs' }],
      });

      await WorkoutProgressionService.applyStartProgression('wl-1');

      // 62 kg (136.69 lb) + the 5 lb step = 141.69 lb → 142 lb. A metric rounding would have
      // stored 65 kg, which this lifter would read as 143.3 lb.
      expect(kgToDisplay(sets[0].weight, 'imperial')).toBeCloseTo(142, 6);
    });

    it('reads history before opening the writer, so the write lock is not held across it', async () => {
      const events: string[] = [];
      mockDatabase.write.mockImplementationOnce(async (callback: any) => {
        events.push('write');
        return callback({});
      });
      installHistory({
        sets: [planned('s1')],
        previousSets: lastSession(62, 4),
        onHistoryRead: () => events.push('history'),
      });

      await WorkoutProgressionService.applyStartProgression('wl-1');

      expect(events).toEqual(['history', 'write']);
    });

    it('does not open a writer at all when no exercise has history', async () => {
      installHistory({ sets: [planned('s1')] });

      expect(await WorkoutProgressionService.applyStartProgression('wl-1')).toBe(0);
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });

    it('does nothing in manual mode: the plan is copied exactly as it always was', async () => {
      jest.spyOn(SettingsService, 'getWorkoutAutonomy').mockResolvedValue('manual');
      const sets = [planned('s1')];
      installHistory({ sets, previousSets: lastSession(62, 4) });

      expect(await WorkoutProgressionService.applyStartProgression('wl-1')).toBe(0);

      expect(sets[0].weight).toBe(60);
      expect(sets[0].adjustmentJson).toBeUndefined();
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });

    it('leaves an exercise with no history exactly as planned', async () => {
      const sets = [planned('s1')];
      installHistory({ sets });

      expect(await WorkoutProgressionService.applyStartProgression('wl-1')).toBe(0);

      expect(sets[0]).toMatchObject({ weight: 60, reps: 8 });
    });

    it('does not touch a workout that has already begun, or was already progressed', async () => {
      installHistory({
        sets: [
          planned('done', { completionStatus: 'performed' }),
          planned('next', { setOrder: 2 }),
        ],
        previousSets: lastSession(62, 4),
      });
      expect(await WorkoutProgressionService.applyStartProgression('wl-1')).toBe(0);

      mockDatabase.get.mockReset();
      installHistory({
        sets: [planned('s1', { adjustmentJson: '{"cause":"progression"}' })],
        previousSets: lastSession(62, 4),
      });
      expect(await WorkoutProgressionService.applyStartProgression('wl-1')).toBe(0);
    });

    it('leaves warm-ups and a pyramid exactly as planned', async () => {
      const warm = planned('warm', { setType: 'warmup', weight: 30, reps: 5, setOrder: 1 });
      const top = planned('top', { weight: 60, reps: 8, setOrder: 2 });
      const backOff = planned('back-off', { weight: 50, reps: 10, setOrder: 3 });
      installHistory({ sets: [warm, top, backOff], previousSets: lastSession(62, 4) });

      await WorkoutProgressionService.applyStartProgression('wl-1');

      expect(warm.weight).toBe(30);
      expect(top.weight).toBe(65);
      expect(backOff.weight).toBe(50);
    });

    it('deloads by one step when the last session left nothing in reserve', async () => {
      const sets = [planned('s1')];
      installHistory({ sets, previousSets: lastSession(70, 0) });

      await WorkoutProgressionService.applyStartProgression('wl-1');

      expect(sets[0].weight).toBe(68); // 70 − 2.5, to a whole kilogram
      expect(JSON.parse(sets[0].adjustmentJson)).toMatchObject({
        cause: 'deload',
        field: 'weight',
        from: 60,
        to: 68,
        last: { weightKg: 70, averageRepsInReserve: 0 },
      });
    });

    it('repeats last time instead of a stale plan when it was about right', async () => {
      const sets = [planned('s1')];
      installHistory({ sets, previousSets: lastSession(70, 2) });

      await WorkoutProgressionService.applyStartProgression('wl-1');

      expect(sets[0].weight).toBe(70);
      expect(JSON.parse(sets[0].adjustmentJson)).toMatchObject({
        cause: 'repeat',
        from: 60,
        to: 70,
      });
    });

    it('leaves a set alone when the target already equals the plan', async () => {
      const sets = [planned('s1', { weight: 70 })];
      installHistory({ sets, previousSets: lastSession(70, 2) });

      expect(await WorkoutProgressionService.applyStartProgression('wl-1')).toBe(0);
      expect(sets[0].adjustmentJson).toBeUndefined();
    });

    it('skips cardio and mobility, which have no load and reps to progress', async () => {
      const sets = [planned('s1')];
      installHistory({
        sets,
        previousSets: lastSession(62, 4),
        exercise: { mechanicType: 'cardio' },
      });

      expect(await WorkoutProgressionService.applyStartProgression('wl-1')).toBe(0);
    });

    it('surfaces a write failure to its caller, which is why startWorkoutFromTemplate wraps it', async () => {
      const sets = [planned('s1')];
      installHistory({ sets, previousSets: lastSession(62, 4) });
      mockDatabase.write.mockRejectedValueOnce(new Error('db busy'));

      await expect(WorkoutProgressionService.applyStartProgression('wl-1')).rejects.toThrow(
        'db busy'
      );
    });

    it('reverts a progression to what the user did last time and clears the explanation', async () => {
      const set = planned('s1', {
        weight: 65,
        adjustmentJson: JSON.stringify({
          cause: 'progression',
          field: 'weight',
          from: 60,
          to: 65,
          plan: { weightKg: 60, reps: 8 },
          last: { weightKg: 62, reps: 7, averageRepsInReserve: 4 },
          now: { weightKg: 65, reps: 8 },
        }),
      });
      installHistory({ sets: [set] });

      expect(await WorkoutProgressionService.revertStartAdjustment('le-bench')).toBe(1);

      expect(set).toMatchObject({ weight: 62, reps: 7, adjustmentJson: undefined });
    });

    it('reverts a repeat — which already is last time — to the plan', async () => {
      const set = planned('s1', {
        weight: 62,
        adjustmentJson: JSON.stringify({
          cause: 'repeat',
          field: 'weight',
          from: 60,
          to: 62,
          plan: { weightKg: 60, reps: 8 },
          last: { weightKg: 62, reps: 8, averageRepsInReserve: 2 },
          now: { weightKg: 62, reps: 8 },
        }),
      });
      installHistory({ sets: [set] });

      await WorkoutProgressionService.revertStartAdjustment('le-bench');

      expect(set).toMatchObject({ weight: 60, reps: 8 });
    });

    it('ignores sets with no adjustment, a corrupt one, or that are no longer planned', async () => {
      const plain = planned('plain');
      const corrupt = planned('corrupt', { adjustmentJson: 'not json' });
      const done = planned('done', {
        completionStatus: 'performed',
        adjustmentJson: '{"cause":"progression"}',
      });
      installHistory({ sets: [plain, corrupt, done] });

      expect(await WorkoutProgressionService.revertStartAdjustment('le-bench')).toBe(0);
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });
  });
});
