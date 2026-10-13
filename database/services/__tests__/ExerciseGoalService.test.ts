import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => ({ kind: 'eq', value })),
    notEq: jest.fn((value: unknown) => ({ kind: 'notEq', value })),
    lt: jest.fn((value: unknown) => ({ kind: 'lt', value })),
    sortBy: jest.fn((field: string, direction: string) => ({ kind: 'sortBy', field, direction })),
    skip: jest.fn((count: number) => ({ kind: 'skip', count })),
    take: jest.fn((count: number) => ({ kind: 'take', count })),
    asc: 'asc',
    desc: 'desc',
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: {
    get: jest.fn(),
    // `ExerciseGoal.markAsDeleted` is a `@writer`, so a service with an open write block has
    // to reach it through `writer.callWriter` rather than nesting a second writer.
    write: jest.fn(async (callback: (writer?: unknown) => unknown) =>
      callback({ callWriter: (work: () => unknown) => Promise.resolve(work()) })
    ),
  },
}));

// Reading a 1RM goal's inputs pulls in analytics and the user services; their models need the real
// WatermelonDB, which this file replaces with a `Q`-only stub, so they are stubbed at the seam.
jest.mock('@/database/services/WorkoutAnalytics', () => ({
  WorkoutAnalytics: {
    getProgressiveOverloadData: jest.fn(),
    getPerformed1RMDate: jest.fn(),
    getRecentFirstSetAverage1RM: jest.fn(),
  },
}));
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { getUserBodyWeightKgForVolume: jest.fn() },
}));
jest.mock('@/database/services/UserService', () => ({
  UserService: { getCurrentUser: jest.fn() },
}));

import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import { WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';

const mockDatabase = database as jest.Mocked<typeof database>;

const IS_NULL = { kind: 'eq', value: null };
const IS_NOT_NULL = { kind: 'notEq', value: null };

/** A stored goal whose `update` applies the mutator to the record itself. */
function stubGoal(overrides: Record<string, unknown> = {}) {
  const record: any = {
    id: 'goal-1',
    goalType: '1rm',
    exerciseId: 'ex-1',
    effectiveUntil: null,
    createdAt: 1_000,
    deletedAt: undefined,
    ...overrides,
  };
  record.update = jest.fn(async (mutator: (r: any) => void) => mutator(record));
  record.markAsDeleted = jest.fn().mockResolvedValue(undefined);
  return record;
}

/**
 * Wires `database.get` to one collection. `fetchResults` is consumed one call at a
 * time so a method issuing several queries can be given a different answer for each.
 */
function withCollection(options: {
  fetchResults?: unknown[][];
  find?: jest.Mock;
  created?: Record<string, unknown>;
}) {
  const results = [...(options.fetchResults ?? [])];
  const query = jest.fn(() => ({
    extend: jest.fn(function (this: unknown) {
      return this;
    }),
    fetch: jest.fn().mockResolvedValue(results.shift() ?? []),
  }));

  const created = options.created ?? {};
  const collection: any = {
    query,
    find: options.find ?? jest.fn(),
    create: jest.fn((callback: (r: any) => void) => {
      callback(created);
      return created;
    }),
  };

  mockDatabase.get.mockReturnValue(collection);
  return { collection, query, created };
}

describe('ExerciseGoalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('active-goal reads', () => {
    it('treats "active" as effective_until IS NULL and not soft-deleted, newest first', async () => {
      const { query } = withCollection({});

      await ExerciseGoalService.getActiveGoals();

      expect(mockDatabase.get).toHaveBeenCalledWith('exercise_goals');
      expect(Q.where).toHaveBeenCalledWith('effective_until', IS_NULL);
      expect(Q.where).toHaveBeenCalledWith('deleted_at', IS_NULL);
      expect(Q.sortBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(query.mock.calls[0]).toHaveLength(3);
    });

    it('returns the single newest consistency goal, or null when the user has none', async () => {
      const goal = stubGoal({ goalType: 'consistency' });
      withCollection({ fetchResults: [[goal]] });

      await expect(ExerciseGoalService.getActiveConsistencyGoal()).resolves.toBe(goal);
      expect(Q.where).toHaveBeenCalledWith('goal_type', 'consistency');
      expect(Q.take).toHaveBeenCalledWith(1);

      jest.clearAllMocks();
      withCollection({ fetchResults: [[]] });
      await expect(ExerciseGoalService.getActiveConsistencyGoal()).resolves.toBeNull();
    });

    it('scopes a per-exercise lookup to both the exercise and the goal type', async () => {
      const { query } = withCollection({ fetchResults: [[]] });

      await expect(ExerciseGoalService.getActiveGoalForExercise('ex-9', '1rm')).resolves.toBeNull();

      expect(Q.where).toHaveBeenCalledWith('exercise_id', 'ex-9');
      expect(Q.where).toHaveBeenCalledWith('goal_type', '1rm');
      expect(query.mock.calls[0]).toHaveLength(5);
    });
  });

  describe('getGoalHistory', () => {
    it('is the complement of the active query: effective_until IS NOT NULL', async () => {
      withCollection({});

      await ExerciseGoalService.getGoalHistory();

      expect(Q.where).toHaveBeenCalledWith('effective_until', IS_NOT_NULL);
      expect(Q.where).toHaveBeenCalledWith('deleted_at', IS_NULL);
    });

    it('adds no pagination clauses when neither limit nor offset is given', async () => {
      const extend = jest.fn();
      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue({ extend, fetch: jest.fn().mockResolvedValue([]) }),
      } as any);

      await ExerciseGoalService.getGoalHistory();

      expect(extend).not.toHaveBeenCalled();
    });

    it('skips then takes when paging, and treats offset 0 as no skip', async () => {
      const query: any = {
        extend: jest.fn(() => query),
        fetch: jest.fn().mockResolvedValue([]),
      };
      mockDatabase.get.mockReturnValue({ query: jest.fn().mockReturnValue(query) } as any);

      await ExerciseGoalService.getGoalHistory(10, 20);
      expect(query.extend).toHaveBeenNthCalledWith(1, { kind: 'skip', count: 20 });
      expect(query.extend).toHaveBeenNthCalledWith(2, { kind: 'take', count: 10 });

      query.extend.mockClear();
      await ExerciseGoalService.getGoalHistory(10, 0);
      expect(query.extend).toHaveBeenCalledTimes(1);
      expect(query.extend).toHaveBeenCalledWith({ kind: 'take', count: 10 });
    });
  });

  describe('saveGoal', () => {
    it('supersedes the previous 1RM goal for the same exercise inside the creating write', async () => {
      const previous = stubGoal({ id: 'goal-old' });
      const { created } = withCollection({ fetchResults: [[previous]] });

      let supersededInsideWrite = false;
      (mockDatabase.write as jest.Mock).mockImplementationOnce(async (callback: () => unknown) => {
        expect(previous.update).not.toHaveBeenCalled();
        const result = await callback();
        supersededInsideWrite = previous.update.mock.calls.length === 1;
        return result;
      });

      const result = await ExerciseGoalService.saveGoal({
        goalType: '1rm',
        exerciseId: 'ex-1',
        targetWeight: 120,
      });

      // Superseding the old goal and inserting the new one must be one transaction,
      // otherwise a crash between them leaves the user with zero or two active goals.
      expect(supersededInsideWrite).toBe(true);
      expect(previous.effectiveUntil).toEqual(expect.any(Number));
      expect(result).toBe(created);
      expect((created as any).effectiveUntil).toBeNull();
      expect((created as any).targetWeight).toBe(120);
    });

    it('supersedes every active consistency goal, not just the newest one', async () => {
      const stale = [stubGoal({ id: 'a' }), stubGoal({ id: 'b' })];
      withCollection({ fetchResults: [stale] });

      await ExerciseGoalService.saveGoal({ goalType: 'consistency', targetSessionsPerWeek: 4 });

      expect(stale.map((g) => typeof g.effectiveUntil)).toEqual(['number', 'number']);
    });

    it('does not look for a goal to supersede when a 1RM goal has no exercise', async () => {
      const { query } = withCollection({});

      await ExerciseGoalService.saveGoal({ goalType: '1rm', targetWeight: 100 });

      expect(query).not.toHaveBeenCalled();
    });

    it('stores omitted optional fields as null so the IS NULL active-goal query matches', async () => {
      const { created } = withCollection({});

      await ExerciseGoalService.saveGoal({ goalType: 'steps_per_day', targetStepsPerDay: 8000 });

      expect(created).toMatchObject({
        exerciseId: null,
        exerciseNameSnapshot: null,
        targetWeight: null,
        baseline1rm: null,
        targetSessionsPerWeek: null,
        targetDistanceM: null,
        targetDurationS: null,
        targetPaceMsPerM: null,
        targetDate: null,
        notes: null,
        effectiveUntil: null,
        targetStepsPerDay: 8000,
      });
      expect((created as any).timezone).toMatch(/^[+-]\d{2}:\d{2}$/);
      expect((created as any).createdAt).toBe((created as any).updatedAt);
    });
  });

  describe('updateGoal', () => {
    it('reads the goal inside the write so the deleted-check and the update are atomic', async () => {
      const goal = stubGoal();
      const find = jest.fn().mockResolvedValue(goal);
      withCollection({ find });

      (mockDatabase.write as jest.Mock).mockImplementationOnce(async (callback: () => unknown) => {
        expect(find).not.toHaveBeenCalled();
        return await callback();
      });

      await ExerciseGoalService.updateGoal('goal-1', { targetWeight: 140 });

      expect(find).toHaveBeenCalledTimes(1);
    });

    it('writes only the fields present in the patch', async () => {
      const goal = stubGoal({ targetWeight: 100, targetSessionsPerWeek: 3, notes: 'keep me' });
      withCollection({ find: jest.fn().mockResolvedValue(goal) });

      await ExerciseGoalService.updateGoal('goal-1', { targetWeight: 140 });

      expect(goal.targetWeight).toBe(140);
      expect(goal.targetSessionsPerWeek).toBe(3);
      expect(goal.notes).toBe('keep me');
    });

    it('never touches baseline_1rm — the baseline is the reference point progress is measured from', async () => {
      const goal = stubGoal({ baseline1rm: 90 });
      withCollection({ find: jest.fn().mockResolvedValue(goal) });

      await ExerciseGoalService.updateGoal('goal-1', {
        baseline1rm: 200,
        targetWeight: 150,
      } as any);

      expect(goal.baseline1rm).toBe(90);
      expect(goal.targetWeight).toBe(150);
    });

    it('clears the target date when it is explicitly set to null', async () => {
      const goal = stubGoal({ targetDate: '2026-12-01' });
      withCollection({ find: jest.fn().mockResolvedValue(goal) });

      await ExerciseGoalService.updateGoal('goal-1', { targetDate: null });

      expect(goal.targetDate).toBeNull();
    });

    it('refuses to update a soft-deleted goal', async () => {
      const goal = stubGoal({ deletedAt: 123 });
      withCollection({ find: jest.fn().mockResolvedValue(goal) });

      await expect(ExerciseGoalService.updateGoal('goal-1', { notes: 'x' })).rejects.toThrow(
        'Cannot update deleted goal'
      );
      expect(goal.update).not.toHaveBeenCalled();
    });
  });

  describe('updateBaseline1rm', () => {
    it('is the only path that writes the baseline, and rejects deleted goals', async () => {
      const goal = stubGoal({ baseline1rm: 90, targetWeight: 120 });
      withCollection({ find: jest.fn().mockResolvedValue(goal) });

      await ExerciseGoalService.updateBaseline1rm('goal-1', 105);
      expect(goal.baseline1rm).toBe(105);
      expect(goal.targetWeight).toBe(120);

      const deleted = stubGoal({ deletedAt: 1 });
      withCollection({ find: jest.fn().mockResolvedValue(deleted) });
      await expect(ExerciseGoalService.updateBaseline1rm('goal-1', 105)).rejects.toThrow(
        'Cannot update deleted goal'
      );
    });
  });

  describe('deleteGoal', () => {
    it('reactivates the most recent superseded goal of the same type', async () => {
      const goal = stubGoal({ goalType: 'consistency', exerciseId: null, createdAt: 5_000 });
      const previous = stubGoal({ id: 'goal-prev', effectiveUntil: 4_999 });
      withCollection({ find: jest.fn().mockResolvedValue(goal), fetchResults: [[previous]] });

      await ExerciseGoalService.deleteGoal('goal-1');

      expect(goal.markAsDeleted).toHaveBeenCalledTimes(1);
      expect(previous.effectiveUntil).toBeNull();
      // Only goals that predate the deleted one may be restored.
      expect(Q.where).toHaveBeenCalledWith('created_at', { kind: 'lt', value: 5_000 });
      expect(Q.where).toHaveBeenCalledWith('effective_until', IS_NOT_NULL);
      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    });

    it('restricts the 1RM restore to the same exercise', async () => {
      const goal = stubGoal({ goalType: '1rm', exerciseId: 'ex-7', createdAt: 5_000 });
      const { query } = withCollection({
        find: jest.fn().mockResolvedValue(goal),
        fetchResults: [[]],
      });

      await ExerciseGoalService.deleteGoal('goal-1');

      // The exercise-scoped query replaces the type-only one, so it is the last built.
      const lastClauses = query.mock.calls[query.mock.calls.length - 1];
      expect(lastClauses).toContainEqual({ field: 'exercise_id', condition: 'ex-7' });
      expect(lastClauses).toContainEqual({ field: 'goal_type', condition: '1rm' });
    });

    it('does not resurrect anything when the deleted goal was already superseded', async () => {
      const goal = stubGoal({ effectiveUntil: 999 });
      const { query } = withCollection({ find: jest.fn().mockResolvedValue(goal) });

      await ExerciseGoalService.deleteGoal('goal-1');

      expect(goal.markAsDeleted).toHaveBeenCalledTimes(1);
      expect(query).not.toHaveBeenCalled();
    });

    it('deletes cleanly when there is no earlier goal to restore', async () => {
      const goal = stubGoal({ goalType: 'consistency', exerciseId: null });
      withCollection({ find: jest.fn().mockResolvedValue(goal), fetchResults: [[]] });

      await expect(ExerciseGoalService.deleteGoal('goal-1')).resolves.toBeUndefined();
      expect(goal.markAsDeleted).toHaveBeenCalledTimes(1);
    });
  });
});

describe('1RM goal evaluation', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const point = (daysAgo: number, estimated1RM: number) => ({
    date: Date.now() - daysAgo * DAY,
    weight: estimated1RM,
    reps: 1,
    volume: estimated1RM,
    estimated1RM,
  });
  const goal = (overrides: Record<string, unknown> = {}) =>
    stubGoal({
      goalType: '1rm',
      exerciseId: 'ex-1',
      targetWeight: 120,
      baseline1rm: 100,
      createdAt: Date.now() - 60 * DAY,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.get.mockReturnValue({
      find: jest.fn().mockResolvedValue({ loadMultiplier: 1 }),
    } as never);
    (WorkoutAnalytics.getPerformed1RMDate as jest.Mock).mockResolvedValue(null);
    (WorkoutAnalytics.getRecentFirstSetAverage1RM as jest.Mock).mockResolvedValue({
      average1RM: 105,
      setCount: 4,
    });
    (UserMetricService.getUserBodyWeightKgForVolume as jest.Mock).mockResolvedValue(80);
    (UserService.getCurrentUser as jest.Mock).mockResolvedValue({ gender: 'male' });
  });

  it('reads only 1RM goals', async () => {
    expect(
      await ExerciseGoalService.load1rmGoalInputs(goal({ goalType: 'consistency' }))
    ).toBeNull();
    expect(await ExerciseGoalService.evaluate1rmGoal(goal({ exerciseId: null }))).toBeNull();
  });

  it('gathers what the projection needs', async () => {
    (WorkoutAnalytics.getProgressiveOverloadData as jest.Mock).mockResolvedValue([point(30, 100)]);
    const inputs = await ExerciseGoalService.load1rmGoalInputs(goal());
    expect(inputs).toMatchObject({
      recentAverage1RM: 105,
      bodyWeight: 80,
      loadMultiplier: 1,
      userGender: 'male',
      hasPerformed1RMDate: null,
    });
    expect(inputs?.dataPoints).toHaveLength(1);
  });

  it('leaves excluded windows out of the data and skips the recent-average shortcut', async () => {
    (WorkoutAnalytics.getProgressiveOverloadData as jest.Mock).mockResolvedValue([
      point(30, 100),
      point(5, 80),
    ]);
    const inputs = await ExerciseGoalService.load1rmGoalInputs(goal(), {
      excludeWindows: [{ from: Date.now() - 10 * DAY, until: Date.now() }],
    });
    expect(inputs?.dataPoints.map((p) => p.estimated1RM)).toEqual([100]);
    // The recent average spans the last two weeks and cannot be filtered by date.
    expect(inputs?.recentAverage1RM).toBeNull();
  });

  it('keeps the recent average when the excluded week is long past', async () => {
    (WorkoutAnalytics.getProgressiveOverloadData as jest.Mock).mockResolvedValue([point(30, 100)]);
    const inputs = await ExerciseGoalService.load1rmGoalInputs(goal(), {
      excludeWindows: [{ from: Date.now() - 40 * DAY, until: Date.now() - 33 * DAY }],
    });
    expect(inputs?.recentAverage1RM).toBe(105);
  });

  it('projects a goal, and has nothing to project without a target or baseline', async () => {
    (WorkoutAnalytics.getProgressiveOverloadData as jest.Mock).mockResolvedValue([
      point(40, 100),
      point(20, 105),
      point(1, 110),
    ]);
    const projection = await ExerciseGoalService.evaluate1rmGoal(goal());
    expect(projection?.status).toBe('on_track');
    expect(projection?.currentEstimated1RM).toBe(105);

    const inputs = await ExerciseGoalService.load1rmGoalInputs(goal());
    expect(ExerciseGoalService.project1rmGoal(goal({ targetWeight: null }), inputs!)).toBeNull();
    expect(
      ExerciseGoalService.project1rmGoal(goal({ baseline1rm: null }), {
        ...inputs!,
        dataPoints: [],
      })
    ).toBeNull();
  });

  it('measures from an explicit baseline when given one', async () => {
    (WorkoutAnalytics.getProgressiveOverloadData as jest.Mock).mockResolvedValue([point(1, 110)]);
    const inputs = await ExerciseGoalService.load1rmGoalInputs(goal());
    const fromGoal = ExerciseGoalService.project1rmGoal(goal(), inputs!);
    const fromOverride = ExerciseGoalService.project1rmGoal(goal(), inputs!, 90);
    expect(fromGoal?.deltaFromBaseline).toBe(5);
    expect(fromOverride?.deltaFromBaseline).toBe(15);
  });
});
