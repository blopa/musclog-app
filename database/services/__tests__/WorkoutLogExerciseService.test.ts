import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { WorkoutLogExerciseService } from '@/database/services/WorkoutLogExerciseService';

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

/**
 * Points `database.get(table)` at per-table rows. Reads that walk several tables in a
 * fixed order (`getWorkoutWithDetails`: log -> log exercises -> sets -> exercises) are
 * far easier to follow this way than as a chain of `mockReturnValueOnce`s. A table may
 * also be given an explicit collection override instead of a row list.
 */
function installTables(tables: Record<string, any[] | { find?: jest.Mock }>) {
  mockDatabase.get.mockImplementation((table: string) => {
    const entry = tables[table];
    if (!entry) {
      return collection() as any;
    }
    if (Array.isArray(entry)) {
      return collection({ fetch: jest.fn().mockResolvedValue(entry) }) as any;
    }
    return collection(entry) as any;
  });
}

describe('WorkoutLogExerciseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearAllMocks` does not drain a `mockReturnValueOnce` queue, so a test that queues
    // more collections than the service consumes would leak into the next one.
    mockDatabase.get.mockReset();
    mockDatabase.get.mockReturnValue(collection() as any);
  });

  describe('replaceLogExercise', () => {
    /** A log exercise / set stand-in whose `prepareUpdate` applies the updater immediately. */
    const record = (fields: Record<string, unknown>) => {
      const row: any = { ...fields };
      row.prepareUpdate = jest.fn((updater: (draft: any) => void) => {
        updater(row);
        return row;
      });
      return row;
    };

    it('swaps the block and records what it replaced and why, in one batch', async () => {
      const block = record({ id: 'le-1', exerciseId: 'bench', updatedAt: 1 });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutLogExerciseService.replaceLogExercise('le-1', 'db-bench', { reason: 'pain' });

      expect(block).toMatchObject({
        exerciseId: 'db-bench',
        replacedExerciseId: 'bench',
        substitutionReason: 'pain',
      });
      expect(block.updatedAt).toBeGreaterThan(1);
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    });

    it('never touches the template the session came from', async () => {
      const block = record({ id: 'le-1', exerciseId: 'bench', templateExerciseId: 'tpl-ex-1' });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutLogExerciseService.replaceLogExercise('le-1', 'db-bench', {
        reason: 'just_today',
      });

      const touched = mockDatabase.get.mock.calls.map(([table]) => table);
      expect(touched).not.toContain('workout_template_exercises');
      expect(touched).not.toContain('workout_template_sets');
      expect(block.templateExerciseId).toBe('tpl-ex-1');
    });

    it('keeps the ORIGINAL exercise when a block is swapped a second time', async () => {
      const block = record({ id: 'le-1', exerciseId: 'db-bench', replacedExerciseId: 'bench' });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutLogExerciseService.replaceLogExercise('le-1', 'machine-press', {
        reason: 'too_hard',
      });

      expect(block).toMatchObject({
        exerciseId: 'machine-press',
        replacedExerciseId: 'bench',
        substitutionReason: 'too_hard',
      });
    });

    it('resets only the still-planned sets to the new exercise load', async () => {
      const block = record({ id: 'le-1', exerciseId: 'bench' });
      const plannedA = record({ id: 's1', weight: 80, completionStatus: 'planned' });
      const plannedB = record({ id: 's2', weight: 80, completionStatus: 'planned' });
      installTables({
        workout_log_exercises: { find: jest.fn().mockResolvedValue(block) },
        workout_log_sets: [plannedA, plannedB],
      });

      await WorkoutLogExerciseService.replaceLogExercise('le-1', 'fly', {
        reason: 'equipment_unavailable',
        plannedWeightKg: 12.5,
      });

      expect(plannedA.weight).toBe(12.5);
      expect(plannedB.weight).toBe(12.5);
      // The query that finds them must ask for planned sets only: history is never rewritten.
      expect(Q.where).toHaveBeenCalledWith('completion_status', 'planned');
      expect(mockDatabase.batch).toHaveBeenCalledWith(block, plannedA, plannedB);
    });

    it('leaves set weights alone when no planned weight is given', async () => {
      const block = record({ id: 'le-1', exerciseId: 'bench' });
      const planned = record({ id: 's1', weight: 80, completionStatus: 'planned' });
      installTables({
        workout_log_exercises: { find: jest.fn().mockResolvedValue(block) },
        workout_log_sets: [planned],
      });

      await WorkoutLogExerciseService.replaceLogExercise('le-1', 'fly', { reason: 'dislike' });

      expect(planned.weight).toBe(80);
      expect(mockDatabase.batch).toHaveBeenCalledWith(block);
    });

    it('is a no-op when the exercise does not change', async () => {
      const block = record({ id: 'le-1', exerciseId: 'bench' });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutLogExerciseService.replaceLogExercise('le-1', 'bench', { reason: 'pain' });

      expect(mockDatabase.batch).not.toHaveBeenCalled();
      expect(block.substitutionReason).toBeUndefined();
    });
  });
  describe('saveLogExerciseNote', () => {
    const record = (fields: Record<string, unknown>) => {
      const row: any = { ...fields };
      row.prepareUpdate = jest.fn((updater: (draft: any) => void) => {
        updater(row);
        return row;
      });
      return row;
    };

    it('writes the note onto the log exercise in one batch', async () => {
      const block = record({ id: 'le-1', notes: undefined, updatedAt: 1 });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      const result = await WorkoutLogExerciseService.saveLogExerciseNote(
        'le-1',
        '  slow negatives  '
      );

      expect(block.notes).toBe('slow negatives');
      expect(block.updatedAt).toBeGreaterThan(1);
      expect(result).toEqual({ savedToTemplate: false });
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    });

    it('clears the note when it is blank', async () => {
      const block = record({ id: 'le-1', notes: 'old' });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutLogExerciseService.saveLogExerciseNote('le-1', '   ');

      expect(block.notes).toBeUndefined();
    });

    it('leaves the template alone unless asked', async () => {
      const block = record({ id: 'le-1', templateExerciseId: 'tpl-1' });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      await WorkoutLogExerciseService.saveLogExerciseNote('le-1', 'brace');

      expect(mockDatabase.get.mock.calls.map(([table]) => table)).not.toContain(
        'workout_template_exercises'
      );
    });

    it('copies the note to the template exercise in the SAME batch when asked', async () => {
      const block = record({ id: 'le-1', templateExerciseId: 'tpl-1' });
      const template = record({ id: 'tpl-1', notes: undefined, deletedAt: null });
      installTables({
        workout_log_exercises: { find: jest.fn().mockResolvedValue(block) },
        workout_template_exercises: { find: jest.fn().mockResolvedValue(template) },
      });

      const result = await WorkoutLogExerciseService.saveLogExerciseNote('le-1', 'brace', {
        alsoSaveToTemplate: true,
      });

      expect(template.notes).toBe('brace');
      expect(result).toEqual({ savedToTemplate: true });
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      expect(mockDatabase.batch).toHaveBeenCalledWith(block, template);
    });

    it('reports that the template was not updated when the block was added mid-session', async () => {
      const block = record({ id: 'le-1', templateExerciseId: undefined });
      installTables({ workout_log_exercises: { find: jest.fn().mockResolvedValue(block) } });

      const result = await WorkoutLogExerciseService.saveLogExerciseNote('le-1', 'brace', {
        alsoSaveToTemplate: true,
      });

      expect(result).toEqual({ savedToTemplate: false });
      expect(block.notes).toBe('brace');
    });

    it('does not resurrect a template exercise that has since been deleted', async () => {
      const block = record({ id: 'le-1', templateExerciseId: 'tpl-1' });
      const template = record({ id: 'tpl-1', notes: 'keep me', deletedAt: 123 });
      installTables({
        workout_log_exercises: { find: jest.fn().mockResolvedValue(block) },
        workout_template_exercises: { find: jest.fn().mockResolvedValue(template) },
      });

      const result = await WorkoutLogExerciseService.saveLogExerciseNote('le-1', 'brace', {
        alsoSaveToTemplate: true,
      });

      expect(result).toEqual({ savedToTemplate: false });
      expect(template.notes).toBe('keep me');
      expect(block.notes).toBe('brace');
    });

    it('still saves the session note when the template lookup fails', async () => {
      const block = record({ id: 'le-1', templateExerciseId: 'tpl-1' });
      installTables({
        workout_log_exercises: { find: jest.fn().mockResolvedValue(block) },
        workout_template_exercises: { find: jest.fn().mockRejectedValue(new Error('not found')) },
      });

      const result = await WorkoutLogExerciseService.saveLogExerciseNote('le-1', 'brace', {
        alsoSaveToTemplate: true,
      });

      expect(result).toEqual({ savedToTemplate: false });
      expect(block.notes).toBe('brace');
    });
  });
  describe('warm-up sets', () => {
    const setRecord = (fields: Record<string, unknown>) => {
      const row: any = { weight: 100, reps: 5, restTimeAfter: 60, deletedAt: null, ...fields };
      row.prepareUpdate = jest.fn((updater: (draft: any) => void) => {
        updater(row);
        return row;
      });
      return row;
    };

    /** Points the three tables the warm-up writer reads at the given rows. */
    function installWorkout(sets: any[]) {
      const created: any[] = [];
      mockDatabase.get.mockImplementation((table: string) => {
        if (table === 'workout_log_exercises') {
          const bench = { id: 'le-bench', workoutLogId: 'wl-1' };
          const squat = { id: 'le-squat', workoutLogId: 'wl-1' };
          return {
            find: jest.fn().mockResolvedValue(bench),
            query: jest
              .fn()
              .mockReturnValue({ fetch: jest.fn().mockResolvedValue([bench, squat]) }),
          } as any;
        }
        if (table === 'workout_log_sets') {
          return {
            query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue(sets) }),
            prepareCreate: jest.fn((builder: (record: any) => void) => {
              const record: any = {};
              builder(record);
              created.push(record);
              return record;
            }),
          } as any;
        }
        return collection() as any;
      });
      return created;
    }

    it('inserts warm-ups before the first working set and shifts every later set', async () => {
      const first = setRecord({
        id: 'bench-1',
        logExerciseId: 'le-bench',
        setOrder: 1,
        completionStatus: 'planned',
        setType: 'normal',
      });
      const second = setRecord({
        id: 'bench-2',
        logExerciseId: 'le-bench',
        setOrder: 2,
        completionStatus: 'planned',
        setType: 'normal',
      });
      // A DIFFERENT exercise later in the workout: set_order is workout-wide, so it must shift too.
      const squat = setRecord({
        id: 'squat-1',
        logExerciseId: 'le-squat',
        setOrder: 3,
        completionStatus: 'planned',
        setType: 'normal',
      });
      const created = installWorkout([first, second, squat]);

      const added = await WorkoutLogExerciseService.addWarmupSets('le-bench', [
        { weightKg: 40, reps: 5 },
        { weightKg: 60, reps: 3 },
      ]);

      expect(added).toBe(2);
      expect([first.setOrder, second.setOrder, squat.setOrder]).toEqual([3, 4, 5]);
      expect(created.map((set) => set.setOrder)).toEqual([1, 2]);
      expect(created).toEqual([
        expect.objectContaining({
          logExerciseId: 'le-bench',
          weight: 40,
          reps: 5,
          setType: 'warmup',
          completionStatus: 'planned',
        }),
        expect.objectContaining({
          logExerciseId: 'le-bench',
          weight: 60,
          reps: 3,
          setType: 'warmup',
          completionStatus: 'planned',
        }),
      ]);
      // One batch: the session can never be observed with two sets sharing an order.
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    });

    it('anchors on the first set still to be done, leaving finished sets where they are', async () => {
      const done = setRecord({
        id: 'bench-1',
        logExerciseId: 'le-bench',
        setOrder: 1,
        completionStatus: 'performed',
        setType: 'normal',
      });
      const next = setRecord({
        id: 'bench-2',
        logExerciseId: 'le-bench',
        setOrder: 2,
        completionStatus: 'planned',
        setType: 'normal',
      });
      const created = installWorkout([done, next]);

      await WorkoutLogExerciseService.addWarmupSets('le-bench', [{ weightKg: 40, reps: 5 }]);

      expect(done.setOrder).toBe(1);
      expect(next.setOrder).toBe(3);
      expect(created[0].setOrder).toBe(2);
    });

    it('does not stack a second ramp on an exercise that already has warm-ups', async () => {
      const warm = setRecord({
        id: 'w',
        logExerciseId: 'le-bench',
        setOrder: 1,
        completionStatus: 'planned',
        setType: 'warmup',
      });
      const work = setRecord({
        id: 'bench-1',
        logExerciseId: 'le-bench',
        setOrder: 2,
        completionStatus: 'planned',
        setType: 'normal',
      });
      installWorkout([warm, work]);

      expect(
        await WorkoutLogExerciseService.addWarmupSets('le-bench', [{ weightKg: 40, reps: 5 }])
      ).toBe(0);
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });

    it('adds nothing when no working set is left to warm up for, or nothing is prescribed', async () => {
      const done = setRecord({
        id: 'bench-1',
        logExerciseId: 'le-bench',
        setOrder: 1,
        completionStatus: 'performed',
        setType: 'normal',
      });
      installWorkout([done]);

      expect(
        await WorkoutLogExerciseService.addWarmupSets('le-bench', [{ weightKg: 40, reps: 5 }])
      ).toBe(0);
      expect(await WorkoutLogExerciseService.addWarmupSets('le-bench', [])).toBe(0);
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });

    it('removes only the warm-ups still to be done', async () => {
      const plannedWarm = setRecord({
        id: 'w1',
        logExerciseId: 'le-bench',
        setOrder: 1,
        completionStatus: 'planned',
        setType: 'warmup',
      });
      const doneWarm = setRecord({
        id: 'w2',
        logExerciseId: 'le-bench',
        setOrder: 2,
        completionStatus: 'performed',
        setType: 'warmup',
      });
      const working = setRecord({
        id: 'bench-1',
        logExerciseId: 'le-bench',
        setOrder: 3,
        completionStatus: 'planned',
        setType: 'normal',
      });
      installWorkout([plannedWarm, doneWarm, working]);

      expect(await WorkoutLogExerciseService.removePlannedWarmupSets('le-bench')).toBe(1);

      expect(plannedWarm.deletedAt).toEqual(expect.any(Number));
      expect(doneWarm.deletedAt).toBeNull();
      expect(working.deletedAt).toBeNull();
    });

    it('does nothing when there are no planned warm-ups to remove', async () => {
      installWorkout([
        setRecord({
          id: 'bench-1',
          logExerciseId: 'le-bench',
          setOrder: 1,
          completionStatus: 'planned',
          setType: 'normal',
        }),
      ]);

      expect(await WorkoutLogExerciseService.removePlannedWarmupSets('le-bench')).toBe(0);
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });
  });
});
