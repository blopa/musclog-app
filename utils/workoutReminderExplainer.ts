import { REMINDER_LEAD_MINUTES, type ReminderLeadMinutes } from '@/utils/notificationPolicy';

/**
 * What a workout reminder carries so the "Why did I get this?" sheet can answer without querying
 * for it afterwards: which workout, which planned weekday, the time it is planned for and how far
 * ahead of it the reminder fired. The day and time are the PLAN's, not the notification's, so the
 * sheet can say what the reminder is about even when the lead time moved it earlier.
 */
export interface WorkoutReminderContext {
  templateId: string;
  /** Monday-first, 0–6. */
  dayIndex: number;
  /** `HH:mm`, local. */
  reminderTime: string;
  leadMinutes: ReminderLeadMinutes;
  /** True when the day comes from a workout plan, false for a schedule set on the workout itself. */
  fromPlan: boolean;
}

export const WORKOUT_REMINDER_ROUTE = '/app/workout/workouts';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const isLead = (value: number): value is ReminderLeadMinutes =>
  (REMINDER_LEAD_MINUTES as readonly number[]).includes(value);

/** The route a tapped workout reminder opens: the workouts list plus the context to explain itself. */
export function workoutReminderRoute(data: Record<string, unknown>): string {
  const templateId = data['templateId'];
  if (typeof templateId !== 'string' || !templateId) {
    return WORKOUT_REMINDER_ROUTE;
  }

  const query = new URLSearchParams({ reminderTemplateId: templateId });
  const dayIndex = data['dayIndex'];
  const reminderTime = data['reminderTime'];
  const leadMinutes = data['leadMinutes'];
  if (typeof dayIndex === 'number') {
    query.set('reminderDay', String(dayIndex));
  }

  if (typeof reminderTime === 'string') {
    query.set('reminderTime', reminderTime);
  }

  if (typeof leadMinutes === 'number') {
    query.set('reminderLead', String(leadMinutes));
  }

  query.set('reminderPlan', data['fromPlan'] === true ? '1' : '0');

  return `${WORKOUT_REMINDER_ROUTE}?${query.toString()}`;
}

type Param = string | string[] | undefined;

const first = (value: Param): string | undefined => (Array.isArray(value) ? value[0] : value);

/**
 * Reads a tapped reminder's context back off the route. A reminder scheduled by an older build
 * carries only the workout, so a missing day or time is not a reason to drop the explanation — it
 * returns `null` only when there is no workout to explain, and the sheet words around the gaps.
 */
export function parseWorkoutReminderParams(params: {
  reminderTemplateId?: Param;
  reminderDay?: Param;
  reminderTime?: Param;
  reminderLead?: Param;
  reminderPlan?: Param;
}): (Partial<WorkoutReminderContext> & { templateId: string }) | null {
  const templateId = first(params.reminderTemplateId)?.trim();
  if (!templateId) {
    return null;
  }

  const day = Number(first(params.reminderDay));
  const time = first(params.reminderTime);
  const lead = Number(first(params.reminderLead));
  const plan = first(params.reminderPlan);

  return {
    templateId,
    ...(first(params.reminderDay) != null && Number.isInteger(day) && day >= 0 && day <= 6
      ? { dayIndex: day }
      : {}),
    ...(time && TIME_PATTERN.test(time) ? { reminderTime: time } : {}),
    ...(first(params.reminderLead) != null && isLead(lead) ? { leadMinutes: lead } : {}),
    ...(plan === '1' || plan === '0' ? { fromPlan: plan === '1' } : {}),
  };
}

/** 2024-01-01 was a Monday: a fixed reference so a Monday-first index formats as a weekday name. */
export function weekdayReferenceDate(dayIndex: number): Date {
  return new Date(2024, 0, 1 + dayIndex);
}
