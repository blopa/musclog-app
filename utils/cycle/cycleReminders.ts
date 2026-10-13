import { PERIOD_REMINDER_LEAD_DAYS } from '@/constants/cycle';
import type { CycleTimeline } from './cycleTimeline';
import { addCalendarDays } from './dates';

export type CycleReminderKind = 'period-start' | 'fertile-window';

export interface CycleReminder {
  kind: CycleReminderKind;
  date: Date;
}

const REMINDER_HOUR = 9;

function atReminderHour(ms: number): Date {
  const date = new Date(ms);
  date.setHours(REMINDER_HOUR, 0, 0, 0);

  return date;
}

/**
 * Which reminders to schedule. A reminder is only worth sending when the prediction behind it is
 * one the cycle screen would show: nothing for an overdue, hidden, suppressed or missing
 * prediction, so a phone never announces a date the app itself no longer stands behind. The
 * fertile-window reminder exists only when the user opted into fertility estimates.
 */
export function planCycleReminders(timeline: CycleTimeline, nowMs: number): CycleReminder[] {
  const { prediction } = timeline;
  if ((prediction.state !== 'upcoming' && prediction.state !== 'window') || !prediction.earliest) {
    return [];
  }

  const reminders: CycleReminder[] = [
    {
      kind: 'period-start',
      // Reminded off the earliest plausible day, so an uncertain prediction errs towards early.
      date: atReminderHour(addCalendarDays(prediction.earliest, -PERIOD_REMINDER_LEAD_DAYS)),
    },
  ];

  if (timeline.fertileEstimate) {
    reminders.push({
      kind: 'fertile-window',
      date: atReminderHour(timeline.fertileEstimate.start),
    });
  }

  return reminders.filter((r) => r.date.getTime() > nowMs);
}
