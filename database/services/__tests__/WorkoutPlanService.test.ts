import { database } from '@/database/database-instance';
import { WorkoutPlanRepository } from '@/database/repositories/WorkoutPlanRepository';
import { WorkoutPlanService } from '@/database/services/WorkoutPlanService';

import { createMockWorkoutPlan, createMockWorkoutPlanTemplate } from './helpers';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, value: unknown) => ({ field, value })),
    eq: jest.fn((value: unknown) => value),
    oneOf: jest.fn((value: unknown) => value),
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(async (callback) => callback()),
    batch: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/database/repositories/WorkoutPlanRepository', () => ({
  WorkoutPlanRepository: {
    getAll: jest.fn(),
    getAllMemberships: jest.fn(),
    getMembershipsForPlan: jest.fn(),
    getMembershipsForTemplate: jest.fn(),
  },
}));

const mockDatabase = database as jest.Mocked<typeof database>;
const mockRepository = WorkoutPlanRepository as jest.Mocked<typeof WorkoutPlanRepository>;

function prepareCollection(records: any[], queryResult: any[] = []) {
  return {
    prepareCreate: jest.fn((callback) => {
      const record: any = { id: `prepared-${records.length + 1}` };
      callback(record);
      records.push(record);
      return record;
    }),
    query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue(queryResult) }),
  };
}

function createMockSchedule(overrides: Partial<any> = {}) {
  const schedule: any = {
    id: 'schedule-1',
    templateId: 'template-1',
    dayOfWeek: 'Monday',
    deletedAt: null,
    prepareUpdate: jest.fn((callback: (record: any) => void) => {
      callback(schedule);
      return schedule;
    }),
    ...overrides,
  };
  return schedule;
}

/**
 * Wires `database.get` for the four collections this service touches.
 *
 * `livePlans` is what a `workout_plans` query resolves to — the plan-liveness check — while
 * `findPlan` is what `.find(id)` returns. They are separate because a plan can be findable and
 * still be deleted, which is exactly the case the ownership rules have to survive.
 */
function mockCollections(options: {
  findPlan?: any;
  livePlans?: any[];
  memberships?: any[];
  membershipRecords?: any[];
  schedules?: any[];
}) {
  const membershipRecords = options.membershipRecords ?? [];
  return mockDatabase.get.mockImplementation((table: string) => {
    if (table === 'workout_plans') {
      return {
        ...prepareCollection([], options.livePlans ?? []),
        find: jest.fn().mockResolvedValue(options.findPlan),
      } as any;
    }
    if (table === 'workout_plan_templates') {
      return prepareCollection(membershipRecords, options.memberships ?? []) as any;
    }
    if (table === 'schedules') {
      return prepareCollection([], options.schedules ?? []) as any;
    }
    throw new Error(`Unexpected collection ${table}`);
  });
}

describe('WorkoutPlanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPlan', () => {
    it('creates the plan and all memberships in one writer and batch', async () => {
      const preparedPlans: any[] = [];
      const preparedMemberships: any[] = [];
      mockDatabase.get.mockImplementation((table: string) => {
        if (table === 'workout_plans') {
          return prepareCollection(preparedPlans) as any;
        }
        if (table === 'schedules') {
          return prepareCollection([]) as any;
        }
        return prepareCollection(preparedMemberships) as any;
      });

      const result = await WorkoutPlanService.createPlan({
        name: ' PPL ',
        cycleType: 'weekly',
        memberships: [
          { templateId: 'push', weekDays: [3, 0, 0] },
          { templateId: 'pull', weekDays: [2] },
        ],
      });

      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      expect(preparedPlans[0]).toMatchObject({ name: 'PPL', cycleType: 'weekly' });
      expect(preparedMemberships).toEqual([
        expect.objectContaining({
          planId: result.id,
          templateId: 'push',
          weekDays: [0, 3],
          position: 0,
        }),
        expect.objectContaining({
          planId: result.id,
          templateId: 'pull',
          weekDays: [2],
          position: 1,
        }),
      ]);
    });

    it('retires the standalone schedules of every workout it files', async () => {
      // Otherwise the old rows stay dormant — invisible while the membership exists, then back on
      // the calendar the moment the workout leaves the plan.
      const schedule = createMockSchedule({ templateId: 'push' });
      mockCollections({ schedules: [schedule] });

      await WorkoutPlanService.createPlan({
        name: 'PPL',
        memberships: [{ templateId: 'push' }],
      });

      expect(schedule.deletedAt).toEqual(expect.any(Number));
      expect(mockDatabase.batch).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        schedule
      );
    });
  });

  describe('savePlan', () => {
    it('saves plan fields and membership changes in one writer and batch', async () => {
      const plan = createMockWorkoutPlan({ name: 'Old', cycleType: 'weekly' });
      const removed = createMockWorkoutPlanTemplate({ templateId: 'old', weekDays: [1] });
      const created: any[] = [];
      mockRepository.getMembershipsForPlan.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([removed]),
      } as any);
      mockCollections({ findPlan: plan, membershipRecords: created });

      await WorkoutPlanService.savePlan('plan-1', { name: ' Updated ', cycleType: 'rotating' }, [
        { templateId: 'new', weekDays: [0, 4] },
      ]);

      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect(mockRepository.getMembershipsForPlan).toHaveBeenCalledWith('plan-1');
      expect(plan).toMatchObject({ name: 'Updated', cycleType: 'rotating' });
      expect(created[0]).toMatchObject({
        planId: 'plan-1',
        templateId: 'new',
        weekDays: undefined,
        position: 0,
      });
      expect(removed.deletedAt).toEqual(expect.any(Number));
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      expect(mockDatabase.batch).toHaveBeenCalledWith(plan, created[0], removed);
    });

    it('diffs add, remove and changed rows while skipping unchanged memberships', async () => {
      const unchanged = createMockWorkoutPlanTemplate({
        templateId: 'push',
        weekDays: [0],
        position: 0,
      });
      const removed = createMockWorkoutPlanTemplate({ templateId: 'pull', position: 1 });
      const changed = createMockWorkoutPlanTemplate({
        templateId: 'legs',
        weekDays: [4],
        position: 2,
      });
      const created: any[] = [];
      const plan = createMockWorkoutPlan();
      mockRepository.getMembershipsForPlan.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([unchanged, removed, changed]),
      } as any);
      mockCollections({ findPlan: plan, membershipRecords: created });

      await WorkoutPlanService.savePlan('plan-1', {}, [
        { templateId: 'push', weekDays: [0], position: 0 },
        { templateId: 'legs', weekDays: [2], position: 1 },
        { templateId: 'cardio', weekDays: [5], position: 2 },
      ]);

      expect(unchanged.prepareUpdate).not.toHaveBeenCalled();
      expect(removed.deletedAt).toEqual(expect.any(Number));
      expect(changed).toMatchObject({ weekDays: [2], position: 1 });
      expect(created[0]).toMatchObject({ templateId: 'cardio', weekDays: [5], position: 2 });
      expect(mockDatabase.batch).toHaveBeenCalledWith(plan, changed, created[0], removed);
    });

    it('reads the current membership set only after entering the writer', async () => {
      const events: string[] = [];
      mockDatabase.write.mockImplementation(async (callback) => {
        events.push('writer');
        return callback();
      });
      mockRepository.getMembershipsForPlan.mockImplementation(() => {
        events.push('membership-read');
        return { fetch: jest.fn().mockResolvedValue([]) } as any;
      });
      mockCollections({ findPlan: createMockWorkoutPlan() });

      await WorkoutPlanService.savePlan('plan-1', {}, []);

      expect(events).toEqual(['writer', 'membership-read']);
    });

    it('never persists weekdays for a rotating plan', async () => {
      const created: any[] = [];
      mockRepository.getMembershipsForPlan.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      } as any);
      mockCollections({
        findPlan: createMockWorkoutPlan({ cycleType: 'rotating' }),
        membershipRecords: created,
      });

      await WorkoutPlanService.savePlan('plan-1', {}, [{ templateId: 'push', weekDays: [0, 3] }]);

      expect(created[0].weekDays).toBeUndefined();
    });

    it('clears existing weekdays when a plan changes from weekly to rotating', async () => {
      // The cycle change and the weekday clearing it implies are one batch: there is no API that
      // can commit the first without the second.
      const plan = createMockWorkoutPlan({ cycleType: 'weekly' });
      const membership = createMockWorkoutPlanTemplate({ templateId: 'push', weekDays: [0, 3] });
      mockRepository.getMembershipsForPlan.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([membership]),
      } as any);
      mockCollections({ findPlan: plan, membershipRecords: [] });

      await WorkoutPlanService.savePlan('plan-1', { cycleType: 'rotating' }, [
        { templateId: 'push', weekDays: [0, 3] },
      ]);

      expect(plan.cycleType).toBe('rotating');
      expect(membership.weekDays).toBeUndefined();
      expect(mockDatabase.batch).toHaveBeenCalledWith(plan, membership);
    });

    it('retires standalone schedules for the workouts it keeps filed', async () => {
      const schedule = createMockSchedule({ templateId: 'push' });
      mockRepository.getMembershipsForPlan.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      } as any);
      mockCollections({ findPlan: createMockWorkoutPlan(), schedules: [schedule] });

      await WorkoutPlanService.savePlan('plan-1', {}, [{ templateId: 'push' }]);

      expect(schedule.deletedAt).toEqual(expect.any(Number));
    });
  });

  it('exposes no way to change plan fields and membership separately', () => {
    // Splitting them lets a cycle-type change commit while its weekday clearing does not.
    expect(WorkoutPlanService).not.toHaveProperty('updatePlan');
    expect(WorkoutPlanService).not.toHaveProperty('setPlanMemberships');
  });

  it('deletes only the plan, whose model writer cascades to its memberships', async () => {
    const plan = createMockWorkoutPlan();
    mockCollections({ findPlan: plan });

    await WorkoutPlanService.deletePlan('plan-1');

    expect(mockDatabase.get).toHaveBeenCalledTimes(1);
    expect(mockDatabase.get).toHaveBeenCalledWith('workout_plans');
    expect(plan.markAsDeleted).toHaveBeenCalledTimes(1);
    expect(mockDatabase.get).not.toHaveBeenCalledWith('workout_templates');
    expect(mockDatabase.get).not.toHaveBeenCalledWith('schedules');
  });

  describe('prepareSyncTemplateMemberships', () => {
    it('prepares plan additions and removals without opening a nested writer', async () => {
      const removed = createMockWorkoutPlanTemplate({ planId: 'old-plan' });
      const preparedMemberships: any[] = [];
      mockRepository.getMembershipsForTemplate.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([removed]),
      } as any);
      mockCollections({
        livePlans: [createMockWorkoutPlan({ id: 'new-plan' })],
        membershipRecords: preparedMemberships,
      });

      const { activePlanIds, records } = await WorkoutPlanService.prepareSyncTemplateMemberships(
        'template-1',
        ['new-plan'],
        123
      );

      expect(removed.deletedAt).toBe(123);
      expect(preparedMemberships[0]).toMatchObject({
        planId: 'new-plan',
        templateId: 'template-1',
        weekDays: undefined,
        position: 0,
      });
      expect(records).toEqual([removed, preparedMemberships[0]]);
      expect(activePlanIds).toEqual(['new-plan']);
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });

    it('opens no writer and touches no schedules when the template stays unplanned', async () => {
      mockRepository.getMembershipsForTemplate.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      } as any);
      mockCollections({});

      const { activePlanIds, records } = await WorkoutPlanService.prepareSyncTemplateMemberships(
        'template-1',
        [],
        123
      );

      expect(records).toEqual([]);
      expect(activePlanIds).toEqual([]);
      expect(mockDatabase.write).not.toHaveBeenCalled();
      expect(mockDatabase.get).not.toHaveBeenCalledWith('schedules');
    });

    it('omits plan ids whose plan is deleted or missing from the resolved membership set', async () => {
      // A stale plan id must not suppress standalone schedules in saveTemplate: the membership
      // would never be created, so the workout really is Unplanned and still owns its calendar.
      mockRepository.getMembershipsForTemplate.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      } as any);
      mockCollections({ livePlans: [] });

      const { activePlanIds, records } = await WorkoutPlanService.prepareSyncTemplateMemberships(
        'template-1',
        ['deleted-plan'],
        123
      );

      expect(activePlanIds).toEqual([]);
      expect(records).toEqual([]);
    });

    it('retires an EXISTING membership whose plan no longer exists', async () => {
      // The liveness check has to cover junction rows that are already there, not just ids being
      // added — otherwise a workout keeps looking planned to a plan that is gone and can never
      // get its own schedule back.
      const orphan = createMockWorkoutPlanTemplate({ planId: 'deleted-plan' });
      mockRepository.getMembershipsForTemplate.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([orphan]),
      } as any);
      mockCollections({ livePlans: [] });

      const { activePlanIds, records } = await WorkoutPlanService.prepareSyncTemplateMemberships(
        'template-1',
        ['deleted-plan'],
        123
      );

      expect(activePlanIds).toEqual([]);
      expect(records).toEqual([orphan]);
      expect(orphan.deletedAt).toBe(123);
    });

    it('retires the template standalone schedules once it belongs to a plan', async () => {
      const schedule = createMockSchedule({ templateId: 'template-1' });
      mockRepository.getMembershipsForTemplate.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      } as any);
      mockCollections({
        livePlans: [createMockWorkoutPlan({ id: 'new-plan' })],
        schedules: [schedule],
      });

      const { records } = await WorkoutPlanService.prepareSyncTemplateMemberships(
        'template-1',
        ['new-plan'],
        123
      );

      expect(records).toContain(schedule);
      expect(schedule.deletedAt).toBe(123);
    });
  });

  describe('getActivePlanIdsForTemplate', () => {
    it('ignores memberships pointing at a plan that no longer exists', async () => {
      mockRepository.getMembershipsForTemplate.mockReturnValue({
        fetch: jest
          .fn()
          .mockResolvedValue([
            createMockWorkoutPlanTemplate({ planId: 'live-plan' }),
            createMockWorkoutPlanTemplate({ planId: 'dead-plan' }),
          ]),
      } as any);
      mockCollections({ livePlans: [createMockWorkoutPlan({ id: 'live-plan' })] });

      await expect(WorkoutPlanService.getActivePlanIdsForTemplate('template-1')).resolves.toEqual([
        'live-plan',
      ]);
    });
  });
});
