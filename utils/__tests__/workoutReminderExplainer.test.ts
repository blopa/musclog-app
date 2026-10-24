import {
  parseWorkoutReminderParams,
  weekdayReferenceDate,
  WORKOUT_REMINDER_ROUTE,
  workoutReminderRoute,
} from '../workoutReminderExplainer';

const toParams = (route: string) => {
  const query = route.split('?')[1] ?? '';
  return Object.fromEntries(new URLSearchParams(query));
};

describe('workoutReminderRoute', () => {
  it('opens the plain workouts list for a reminder without a workout', () => {
    expect(workoutReminderRoute({})).toBe(WORKOUT_REMINDER_ROUTE);
    expect(workoutReminderRoute({ templateId: '' })).toBe(WORKOUT_REMINDER_ROUTE);
  });

  it('round-trips the context a reminder carries through the route', () => {
    const route = workoutReminderRoute({
      templateId: 'tpl 1',
      dayIndex: 4,
      reminderTime: '07:30',
      leadMinutes: 30,
      fromPlan: true,
    });
    expect(route.startsWith(`${WORKOUT_REMINDER_ROUTE}?`)).toBe(true);
    expect(parseWorkoutReminderParams(toParams(route))).toEqual({
      templateId: 'tpl 1',
      dayIndex: 4,
      reminderTime: '07:30',
      leadMinutes: 30,
      fromPlan: true,
    });
  });

  it('marks a schedule set on the workout itself as not from a plan', () => {
    const route = workoutReminderRoute({ templateId: 't', dayIndex: 1, fromPlan: false });
    expect(parseWorkoutReminderParams(toParams(route))?.fromPlan).toBe(false);
  });
});

describe('parseWorkoutReminderParams', () => {
  it('returns nothing when there is no workout to explain', () => {
    expect(parseWorkoutReminderParams({})).toBeNull();
    expect(parseWorkoutReminderParams({ reminderTemplateId: '  ' })).toBeNull();
  });

  it('still explains a reminder an older build scheduled with only the workout', () => {
    expect(parseWorkoutReminderParams({ reminderTemplateId: 't1' })).toEqual({ templateId: 't1' });
  });

  it('drops any field that is not valid rather than showing it', () => {
    expect(
      parseWorkoutReminderParams({
        reminderTemplateId: 't1',
        reminderDay: '9',
        reminderTime: '25:99',
        reminderLead: '7',
        reminderPlan: 'maybe',
      })
    ).toEqual({ templateId: 't1' });
    expect(parseWorkoutReminderParams({ reminderTemplateId: 't1', reminderDay: 'x' })).toEqual({
      templateId: 't1',
    });
  });

  it('accepts monday as day zero and reads the first of a repeated param', () => {
    expect(
      parseWorkoutReminderParams({ reminderTemplateId: ['a', 'b'], reminderDay: ['0', '3'] })
    ).toEqual({ templateId: 'a', dayIndex: 0 });
  });
});

describe('weekdayReferenceDate', () => {
  it('maps a Monday-first index onto the matching weekday', () => {
    expect(weekdayReferenceDate(0).getDay()).toBe(1);
    expect(weekdayReferenceDate(6).getDay()).toBe(0);
  });
});
