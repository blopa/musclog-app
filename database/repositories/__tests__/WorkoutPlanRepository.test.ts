import { database } from '@/database/database-instance';
import { WorkoutPlanRepository } from '@/database/repositories/WorkoutPlanRepository';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, comparison: unknown) => ({
      clause: 'where',
      field,
      comparison,
    })),
    eq: jest.fn((value: unknown) => ({ op: 'eq', value })),
    sortBy: jest.fn((field: string, direction: string) => ({ clause: 'sortBy', field, direction })),
    asc: 'asc',
    desc: 'desc',
  },
}));

jest.mock('@/database/database-instance', () => ({ database: { get: jest.fn() } }));

const mockDatabase = database as jest.Mocked<typeof database>;
const eq = (value: unknown) => ({ op: 'eq', value });
const where = (field: string, comparison: unknown) => ({ clause: 'where', field, comparison });
const sortBy = (field: string, direction: string) => ({ clause: 'sortBy', field, direction });

function stubCollection() {
  const builtQuery = { fetch: jest.fn(), observe: jest.fn() };
  const query = jest.fn(() => builtQuery);
  mockDatabase.get.mockReturnValue({ query } as any);
  return { query, builtQuery };
}

describe('WorkoutPlanRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns active plans newest first', () => {
    const { query, builtQuery } = stubCollection();

    const result = WorkoutPlanRepository.getAll();

    expect(mockDatabase.get).toHaveBeenCalledWith('workout_plans');
    expect(query.mock.calls[0]).toEqual([
      where('deleted_at', eq(null)),
      sortBy('created_at', 'desc'),
    ]);
    expect(result).toBe(builtQuery);
  });

  it('returns one plan membership query in position order', () => {
    const { query } = stubCollection();

    WorkoutPlanRepository.getMembershipsForPlan('plan-1');

    expect(mockDatabase.get).toHaveBeenCalledWith('workout_plan_templates');
    expect(query.mock.calls[0]).toEqual([
      where('plan_id', 'plan-1'),
      where('deleted_at', eq(null)),
      sortBy('position', 'asc'),
    ]);
  });

  it('returns active memberships for a template', () => {
    const { query } = stubCollection();

    WorkoutPlanRepository.getMembershipsForTemplate('template-1');

    expect(query.mock.calls[0]).toEqual([
      where('template_id', 'template-1'),
      where('deleted_at', eq(null)),
    ]);
  });

  it('returns every active membership in position order', () => {
    const { query } = stubCollection();

    WorkoutPlanRepository.getAllMemberships();

    expect(query.mock.calls[0]).toEqual([where('deleted_at', eq(null)), sortBy('position', 'asc')]);
  });

  it('resolves schedules from all three calendar stores in one read', async () => {
    // The read `NotificationService` and `WorkoutService.getUpcomingScheduledWorkouts` had a copy
    // of each. Its job is to consult exactly these three tables and hand them to the ownership
    // rule — a caller that reads only `schedules` silently loses every planned workout.
    const rows: Record<string, unknown[]> = {
      schedules: [
        { templateId: 'planned', dayOfWeek: 'Friday', reminderTime: '17:30' },
        { templateId: 'standalone', dayOfWeek: 'Tuesday', reminderTime: '09:15' },
      ],
      workout_plan_templates: [{ planId: 'p1', templateId: 'planned', weekDays: [0] }],
      workout_plans: [{ id: 'p1', cycleType: 'weekly' }],
    };
    mockDatabase.get.mockImplementation(
      (table: string) =>
        ({
          query: jest.fn(() => ({ fetch: jest.fn().mockResolvedValue(rows[table] ?? []) })),
        }) as any
    );

    const resolved = await WorkoutPlanRepository.getResolvedSchedules();

    expect(mockDatabase.get.mock.calls.map(([table]) => table).sort()).toEqual([
      'schedules',
      'workout_plan_templates',
      'workout_plans',
    ]);
    // The plan owns `planned`'s calendar, so its standalone Friday row is ignored entirely.
    expect(resolved).toEqual([
      { templateId: 'planned', planId: 'p1', dayIndex: 0, reminderTime: '08:00' },
      { templateId: 'standalone', dayIndex: 1, reminderTime: '09:15' },
    ]);
  });

  it('keeps every query lazy', () => {
    for (const call of [
      () => WorkoutPlanRepository.getAll(),
      () => WorkoutPlanRepository.getMembershipsForPlan('p1'),
      () => WorkoutPlanRepository.getMembershipsForTemplate('t1'),
      () => WorkoutPlanRepository.getAllMemberships(),
    ]) {
      jest.clearAllMocks();
      const { builtQuery } = stubCollection();
      call();
      expect(builtQuery.fetch).not.toHaveBeenCalled();
      expect(builtQuery.observe).not.toHaveBeenCalled();
    }
  });
});
