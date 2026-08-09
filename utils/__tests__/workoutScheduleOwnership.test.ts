import { resolveWorkoutLogPlanId, resolveWorkoutSchedules } from '@/utils/workoutScheduleOwnership';

describe('resolveWorkoutLogPlanId', () => {
  it('keeps explicit section context without consulting membership count', () => {
    expect(
      resolveWorkoutLogPlanId('selected-plan', [{ planId: 'first' }, { planId: 'second' }])
    ).toBe('selected-plan');
  });

  it('falls back only when exactly one active membership exists', () => {
    expect(
      resolveWorkoutLogPlanId(undefined, [
        { planId: 'active' },
        { planId: 'deleted', deletedAt: 123 },
      ])
    ).toBe('active');
    expect(
      resolveWorkoutLogPlanId(undefined, [{ planId: 'first' }, { planId: 'second' }])
    ).toBeUndefined();
    expect(resolveWorkoutLogPlanId(undefined, [])).toBeUndefined();
  });
});

describe('resolveWorkoutSchedules', () => {
  it('uses contextual weekly days and suppresses the planned template standalone rows', () => {
    const result = resolveWorkoutSchedules(
      [{ id: 'p1', cycleType: 'weekly' }],
      [{ planId: 'p1', templateId: 'push', weekDays: [0, 3] }],
      [{ templateId: 'push', dayOfWeek: 'Friday', reminderTime: '09:00' }]
    );

    expect(result).toEqual([
      { templateId: 'push', planId: 'p1', dayIndex: 0, reminderTime: '08:00' },
      { templateId: 'push', planId: 'p1', dayIndex: 3, reminderTime: '08:00' },
    ]);
  });

  it('does not calendar-schedule rotating or unscheduled weekly memberships', () => {
    expect(
      resolveWorkoutSchedules(
        [
          { id: 'rotation', cycleType: 'rotating' },
          { id: 'weekly', cycleType: 'weekly' },
        ],
        [
          { planId: 'rotation', templateId: 'push', weekDays: [0] },
          { planId: 'weekly', templateId: 'pull' },
        ],
        [
          { templateId: 'push', dayOfWeek: 'Monday' },
          { templateId: 'pull', dayOfWeek: 'Tuesday' },
        ]
      )
    ).toEqual([]);
  });

  it('uses standalone rows when a template has no valid active membership', () => {
    const result = resolveWorkoutSchedules(
      [],
      [{ planId: 'deleted-plan', templateId: 'push', weekDays: [0] }],
      [{ templateId: 'push', dayOfWeek: 'Friday', reminderTime: '10:30' }]
    );

    expect(result).toEqual([{ templateId: 'push', dayIndex: 4, reminderTime: '10:30' }]);
  });

  it('deduplicates identical plan-derived reminders while retaining a plan id', () => {
    const result = resolveWorkoutSchedules(
      [
        { id: 'p1', cycleType: 'weekly' },
        { id: 'p2', cycleType: 'weekly' },
      ],
      [
        { planId: 'p1', templateId: 'push', weekDays: [0] },
        { planId: 'p2', templateId: 'push', weekDays: [0] },
      ],
      []
    );

    expect(result).toEqual([
      { templateId: 'push', planId: 'p1', dayIndex: 0, reminderTime: '08:00' },
    ]);
  });
});
