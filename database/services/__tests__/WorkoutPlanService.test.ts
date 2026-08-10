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

function prepareCollection(records: any[]) {
  return {
    prepareCreate: jest.fn((callback) => {
      const record: any = { id: `prepared-${records.length + 1}` };
      callback(record);
      records.push(record);
      return record;
    }),
    query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
  };
}

describe('WorkoutPlanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the plan and all memberships in one writer and batch', async () => {
    const preparedPlans: any[] = [];
    const preparedMemberships: any[] = [];
    mockDatabase.get.mockImplementation((table: string) =>
      table === 'workout_plans'
        ? (prepareCollection(preparedPlans) as any)
        : (prepareCollection(preparedMemberships) as any)
    );

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
    mockDatabase.get.mockImplementation((table: string) => {
      if (table === 'workout_plans') {
        return { find: jest.fn().mockResolvedValue(plan) } as any;
      }
      return prepareCollection(created) as any;
    });

    await WorkoutPlanService.setPlanMemberships('plan-1', [
      { templateId: 'push', weekDays: [0], position: 0 },
      { templateId: 'legs', weekDays: [2], position: 1 },
      { templateId: 'cardio', weekDays: [5], position: 2 },
    ]);

    expect(unchanged.prepareUpdate).not.toHaveBeenCalled();
    expect(removed.deletedAt).toEqual(expect.any(Number));
    expect(changed).toMatchObject({ weekDays: [2], position: 1 });
    expect(created[0]).toMatchObject({ templateId: 'cardio', weekDays: [5], position: 2 });
    expect(mockDatabase.batch).toHaveBeenCalledWith(changed, created[0], removed);
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
    mockDatabase.get.mockImplementation((table: string) =>
      table === 'workout_plans'
        ? ({ find: jest.fn().mockResolvedValue(createMockWorkoutPlan()) } as any)
        : (prepareCollection([]) as any)
    );

    await WorkoutPlanService.setPlanMemberships('plan-1', []);

    expect(events).toEqual(['writer', 'membership-read']);
  });

  it('saves plan fields and membership changes in one writer and batch', async () => {
    const plan = createMockWorkoutPlan({ name: 'Old', cycleType: 'weekly' });
    const removed = createMockWorkoutPlanTemplate({ templateId: 'old', weekDays: [1] });
    const created: any[] = [];
    mockRepository.getMembershipsForPlan.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([removed]),
    } as any);
    mockDatabase.get.mockImplementation((table: string) =>
      table === 'workout_plans'
        ? ({ find: jest.fn().mockResolvedValue(plan) } as any)
        : (prepareCollection(created) as any)
    );

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

  it('never persists weekdays for a rotating plan', async () => {
    const created: any[] = [];
    mockRepository.getMembershipsForPlan.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([]),
    } as any);
    mockDatabase.get.mockImplementation((table: string) =>
      table === 'workout_plans'
        ? ({
            find: jest.fn().mockResolvedValue(createMockWorkoutPlan({ cycleType: 'rotating' })),
          } as any)
        : (prepareCollection(created) as any)
    );

    await WorkoutPlanService.setPlanMemberships('plan-1', [
      { templateId: 'push', weekDays: [0, 3] },
    ]);

    expect(created[0].weekDays).toBeUndefined();
  });

  it('clears existing weekdays when a plan changes from weekly to rotating', async () => {
    const plan = createMockWorkoutPlan({ cycleType: 'weekly' });
    const membership = createMockWorkoutPlanTemplate({ weekDays: [0, 3] });
    mockDatabase.get.mockReturnValue({ find: jest.fn().mockResolvedValue(plan) } as any);
    mockRepository.getMembershipsForPlan.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([membership]),
    } as any);

    await WorkoutPlanService.updatePlan('plan-1', { cycleType: 'rotating' });

    expect(plan.cycleType).toBe('rotating');
    expect(membership.weekDays).toBeUndefined();
    expect(mockDatabase.batch).toHaveBeenCalledWith(plan, membership);
  });

  it('deletes only the plan through its cascading model writer', async () => {
    const plan = createMockWorkoutPlan();
    const find = jest.fn().mockResolvedValue(plan);
    mockDatabase.get.mockReturnValue({ find } as any);

    await WorkoutPlanService.deletePlan('plan-1');

    expect(mockDatabase.get).toHaveBeenCalledTimes(1);
    expect(mockDatabase.get).toHaveBeenCalledWith('workout_plans');
    expect(plan.markAsDeleted).toHaveBeenCalledTimes(1);
    expect(mockDatabase.get).not.toHaveBeenCalledWith('workout_templates');
    expect(mockDatabase.get).not.toHaveBeenCalledWith('schedules');
  });

  it('prepares plan additions and removals without opening a nested writer or touching schedules', async () => {
    const removed = createMockWorkoutPlanTemplate({ planId: 'old-plan' });
    const preparedMemberships: any[] = [];
    mockRepository.getMembershipsForTemplate.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([removed]),
    } as any);
    mockDatabase.get.mockImplementation((table: string) => {
      if (table === 'workout_plans') {
        return {
          query: jest.fn().mockReturnValue({
            fetch: jest.fn().mockResolvedValue([createMockWorkoutPlan({ id: 'new-plan' })]),
          }),
        } as any;
      }
      if (table === 'workout_plan_templates') {
        const collection = prepareCollection(preparedMemberships);
        collection.query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) });
        return collection as any;
      }
      throw new Error(`Unexpected collection ${table}`);
    });

    const records = await WorkoutPlanService.prepareSyncTemplateMemberships(
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
    expect(mockDatabase.write).not.toHaveBeenCalled();
    expect(mockDatabase.get).not.toHaveBeenCalledWith('schedules');
  });

  it('prepareSyncTemplateMemberships opens no writer and leaves schedules untouched', async () => {
    mockRepository.getMembershipsForTemplate.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([]),
    } as any);

    const records = await WorkoutPlanService.prepareSyncTemplateMemberships('template-1', [], 123);

    expect(records).toEqual([]);
    expect(mockDatabase.write).not.toHaveBeenCalled();
    expect(mockDatabase.get).not.toHaveBeenCalledWith('schedules');
  });
});
