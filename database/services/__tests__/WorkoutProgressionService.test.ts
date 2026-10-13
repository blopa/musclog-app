import { database } from '@/database/database-instance';
import { GymService } from '@/database/services/GymService';
import { SettingsService } from '@/database/services/SettingsService';
import { WorkoutProgressionService } from '@/database/services/WorkoutProgressionService';
import { kgToDisplay } from '@/utils/unitConversion';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    on: jest.fn((table: string, clauses: unknown) => ({ table, clauses })),
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
      /** The session before the previous one, for rules that look two sessions back. */
      earlierSets?: any[];
      exercise?: Record<string, unknown>;
      userSettings?: any[];
      onHistoryRead?: () => void;
      /** When each history workout was completed. Rows are returned newest-WRITTEN first. */
      completedAt?: { previous: number; earlier: number };
    }) {
      const previousLogExercise = { id: 'prev-le', workoutLogId: 'wl-prev', createdAt: 2 };
      const earlierLogExercise = { id: 'earlier-le', workoutLogId: 'wl-earlier', createdAt: 1 };
      mockDatabase.get.mockImplementation((table: string) => {
        if (table === 'exercise_user_settings') {
          return collection({ fetch: jest.fn().mockResolvedValue(options.userSettings ?? []) });
        }
        if (table === 'workout_logs') {
          return collection({
            fetch: jest.fn().mockResolvedValue(
              options.completedAt
                ? [
                    { id: 'wl-prev', completedAt: options.completedAt.previous },
                    { id: 'wl-earlier', completedAt: options.completedAt.earlier },
                  ]
                : []
            ),
          }) as any;
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
                if (!options.previousSets) {
                  return [];
                }
                return options.earlierSets
                  ? [previousLogExercise, earlierLogExercise]
                  : [previousLogExercise];
              }),
            })),
          } as any;
        }
        if (table === 'workout_log_sets') {
          return {
            query: jest.fn((...clauses: any[]) => ({
              // History reads every past session's sets in one `oneOf` query.
              fetch: jest.fn(async () => {
                const ids: unknown[] =
                  clauses.find((c) => c?.field === 'log_exercise_id')?.condition ?? [];
                if (
                  ![ids]
                    .flat()
                    .some((id) => id === previousLogExercise.id || id === earlierLogExercise.id)
                ) {
                  return options.sets;
                }
                const tag = (rows: any[] | undefined, logExerciseId: string) =>
                  (rows ?? []).map((set) => ({ logExerciseId, ...set }));
                return [
                  ...tag(options.previousSets, previousLogExercise.id),
                  ...tag(options.earlierSets, earlierLogExercise.id),
                ];
              }),
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
      { weight, reps: 8, repsInReserve, setOrder: 1, completionStatus: 'performed' },
      { weight, reps: 8, repsInReserve, setOrder: 2, completionStatus: 'performed' },
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

    it('holds the load after a single session with nothing left in reserve', async () => {
      const sets = [planned('s1')];
      installHistory({ sets, previousSets: lastSession(70, 0) });

      await WorkoutProgressionService.applyStartProgression('wl-1');

      expect(sets[0].weight).toBe(70);
      expect(JSON.parse(sets[0].adjustmentJson)).toMatchObject({ cause: 'repeat', to: 70 });
    });

    it('deloads by 10% after two sessions in a row with nothing left in reserve', async () => {
      const sets = [planned('s1')];
      installHistory({ sets, previousSets: lastSession(70, 0), earlierSets: lastSession(70, 0) });

      await WorkoutProgressionService.applyStartProgression('wl-1');

      expect(sets[0].weight).toBe(62.5); // 70 − 10%, on a 2.5 kg multiple
      expect(JSON.parse(sets[0].adjustmentJson)).toMatchObject({
        cause: 'deload',
        field: 'weight',
        from: 60,
        to: 62.5,
        last: { weightKg: 70, averageRepsInReserve: 0 },
      });
    });

    it('repeats last time instead of a stale plan when it was about right', async () => {
      const sets = [planned('s1')];
      installHistory({ sets, previousSets: lastSession(70, 1) });

      await WorkoutProgressionService.applyStartProgression('wl-1');

      expect(sets[0].weight).toBe(70);
      expect(JSON.parse(sets[0].adjustmentJson)).toMatchObject({
        cause: 'repeat',
        from: 60,
        to: 70,
      });
    });

    it('takes "last time" from the latest workout, not the latest row written', async () => {
      // The newest-written row belongs to an OLDER workout (an exercise added to it afterwards).
      const sets = [planned('s1')];
      installHistory({
        sets,
        previousSets: lastSession(62, 4),
        earlierSets: lastSession(80, 1),
        completedAt: { previous: 100, earlier: 200 },
      });

      await WorkoutProgressionService.applyStartProgression('wl-1');

      expect(sets[0].weight).toBe(80);
      expect(JSON.parse(sets[0].adjustmentJson)).toMatchObject({ cause: 'repeat', to: 80 });
    });

    it('leaves a set alone when the target already equals the plan', async () => {
      const sets = [planned('s1', { weight: 70 })];
      installHistory({ sets, previousSets: lastSession(70, 1) });

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

    describe('a repeat or lighter week chosen in the Weekly Review', () => {
      /** Layers a `weekly_reviews` row over whatever `installHistory` set up. */
      function installWeek(
        decision: 'repeat' | 'lighter',
        window = { from: Date.now() - 1000, until: Date.now() + 10_000_000 }
      ) {
        const base = mockDatabase.get.getMockImplementation()!;
        mockDatabase.get.mockImplementation((table: string) =>
          table === 'weekly_reviews'
            ? (collection({
                fetch: jest.fn().mockResolvedValue([
                  {
                    id: 'review-1',
                    trainingDecision: decision,
                    trainingJson: JSON.stringify({
                      decision,
                      recommended: 'progress',
                      reasons: [],
                      goals: [],
                      window,
                    }),
                  },
                ]),
              }) as any)
            : base(table)
        );
      }
      const four = () => [1, 2, 3, 4].map((n) => planned(`s${n}`, { setOrder: n }));

      it('lightens loads, drops the trailing third of the sets and aims for plenty in reserve', async () => {
        const sets = four();
        installHistory({ sets, previousSets: lastSession(62, 1) });
        installWeek('lighter');

        await WorkoutProgressionService.applyStartProgression('wl-1');

        const live = sets.filter((set) => !set.deletedAt);
        expect(live.map((set) => set.id)).toEqual(['s1', 's2', 's3']);
        expect(sets[3].deletedAt).toEqual(expect.any(Number));
        // The first two sets follow last session's 62 kg: less 10% (6.2 kg beats the 2.5 kg step)
        // = 55.8, snapped DOWN to 55. Last session had no third set, so the third lightens the
        // plan's own 60 kg: 54, snapped down to 52.5 — never rounded back up towards the plan.
        const expected = [55, 55, 52.5];
        for (const [index, set] of live.entries()) {
          expect(set.weight).toBe(expected[index]);
          expect(set.reps).toBe(8);
          expect(set.repsInReserve).toBe(4);
          expect(JSON.parse(set.adjustmentJson)).toMatchObject({
            cause: 'deload',
            source: 'weekly_review',
            plan: { weightKg: 60, reps: 8 },
            now: { weightKg: expected[index], reps: 8 },
          });
          expect(JSON.parse(set.prescriptionJson)).toMatchObject({ workingSetCount: 3 });
        }
        expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      });

      it('applies in manual mode, because the user chose it', async () => {
        jest.spyOn(SettingsService, 'getWorkoutAutonomy').mockResolvedValue('manual');
        const sets = four();
        installHistory({ sets, previousSets: lastSession(62, 1) });
        installWeek('lighter');

        await WorkoutProgressionService.applyStartProgression('wl-1');

        expect(sets[0].weight).toBe(55);
        expect(sets[3].deletedAt).toEqual(expect.any(Number));
      });

      it('lightens an exercise with no history from its own plan', async () => {
        const sets = four();
        installHistory({ sets });
        installWeek('lighter');

        await WorkoutProgressionService.applyStartProgression('wl-1');

        expect(sets[0].weight).toBeLessThan(60);
        expect(sets.filter((set) => !set.deletedAt)).toHaveLength(3);
      });

      it('repeats last session instead of progressing, and keeps every set', async () => {
        const sets = [planned('s1'), planned('s2', { setOrder: 2 })];
        // Left four in reserve: the automatic path would add a step; a repeat must not.
        installHistory({ sets, previousSets: lastSession(62, 4) });
        installWeek('repeat');

        await WorkoutProgressionService.applyStartProgression('wl-1');

        for (const set of sets) {
          expect(set).toMatchObject({ weight: 62, reps: 8 });
          expect(set.deletedAt).toBeNull();
          expect(JSON.parse(set.adjustmentJson)).toMatchObject({
            cause: 'repeat',
            source: 'weekly_review',
          });
        }
      });

      it('leaves an exercise with no history alone when repeating', async () => {
        const sets = [planned('s1')];
        installHistory({ sets });
        installWeek('repeat');

        await WorkoutProgressionService.applyStartProgression('wl-1');

        expect(sets[0]).toMatchObject({ weight: 60, reps: 8 });
        expect(sets[0].adjustmentJson).toBeUndefined();
      });

      it('does nothing once the window is over', async () => {
        const sets = four();
        installHistory({ sets, previousSets: lastSession(62, 1) });
        installWeek('lighter', { from: Date.now() - 2000, until: Date.now() - 1000 });

        await WorkoutProgressionService.applyStartProgression('wl-1');

        // Back to the ordinary automatic path: nothing was dropped.
        expect(sets.every((set) => !set.deletedAt)).toBe(true);
      });

      it('does not touch warm-ups', async () => {
        const warm = planned('warm', { setType: 'warmup', weight: 30, reps: 5, setOrder: 0 });
        const sets = [warm, ...four()];
        installHistory({ sets, previousSets: lastSession(62, 1) });
        installWeek('lighter');

        await WorkoutProgressionService.applyStartProgression('wl-1');

        expect(warm).toMatchObject({ weight: 30, reps: 5 });
        expect(warm.deletedAt).toBeNull();
      });

      it('leaves a lighter week out of the history the next progression is built from', async () => {
        const lighterWindow = { from: 1000, until: 9000 };
        const sets = [planned('s1')];
        installHistory({
          sets,
          previousSets: lastSession(56, 4),
          earlierSets: lastSession(62, 2),
          // The most recent session happened inside the lighter week.
          completedAt: { previous: 5000, earlier: 500 },
        });
        installWeek('lighter', lighterWindow);
        // The decision's window is over by the time this workout starts, so only history applies.
        jest.spyOn(Date, 'now').mockReturnValue(20_000);

        await WorkoutProgressionService.applyStartProgression('wl-1');

        // Built from the 62 kg session (2 in reserve → hold at the target), not the 56 kg one.
        expect(sets[0].weight).toBeGreaterThanOrEqual(62);
      });
    });
  });
});
