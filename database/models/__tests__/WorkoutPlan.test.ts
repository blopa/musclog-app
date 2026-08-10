import WorkoutPlan from '@/database/models/WorkoutPlan';

jest.mock('@nozbe/watermelondb', () => ({ Model: class {} }));
jest.mock('@nozbe/watermelondb/decorators', () => ({
  children: jest.fn(() => jest.fn()),
  field: jest.fn(() => jest.fn()),
  writer: jest.fn((_target, _property, descriptor) => descriptor),
}));
jest.mock('@/database/models/WorkoutLog', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/WorkoutPlanTemplate', () => ({
  __esModule: true,
  default: class {},
}));

describe('WorkoutPlan.markAsDeleted', () => {
  afterEach(() => jest.restoreAllMocks());

  it('soft-deletes the plan and active memberships in one batch without touching templates', async () => {
    const activeMembership: any = {
      deletedAt: null,
      prepareUpdate: jest.fn((callback) => {
        callback(activeMembership);
        return activeMembership;
      }),
    };
    const deletedMembership: any = {
      deletedAt: 50,
      prepareUpdate: jest.fn(),
    };
    const batch = jest.fn().mockResolvedValue(undefined);
    const plan: any = Object.assign(Object.create(WorkoutPlan.prototype), {
      memberships: {
        fetch: jest.fn().mockResolvedValue([activeMembership, deletedMembership]),
      },
      collection: { database: { batch } },
    });
    plan.prepareUpdate = jest.fn((callback) => {
      callback(plan);
      return plan;
    });
    jest.spyOn(Date, 'now').mockReturnValue(123);

    await plan.markAsDeleted();

    expect(plan.deletedAt).toBe(123);
    expect(activeMembership.deletedAt).toBe(123);
    expect(deletedMembership.prepareUpdate).not.toHaveBeenCalled();
    expect(batch).toHaveBeenCalledWith(plan, activeMembership);
    expect(plan).not.toHaveProperty('workoutTemplates');
  });
});
