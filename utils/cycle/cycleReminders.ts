import { PERIOD_REMINDER_LEAD_DAYS } from '@/constants/cycle';

import type { CycleTimeline } from './cycleTimeline';
import { addCalendarDays } from './dates';
import type { CyclePeriodInput, CycleReminderPreferences } from './types';

export type CycleReminderKind =
  'period-start' | 'fertile-window' | 'daily-log' | 'end-check' | 'backup';
export interface CycleReminder {
  kind: CycleReminderKind;
  date: Date;
}
export const DEFAULT_CYCLE_REMINDERS: CycleReminderPreferences = {
  hour: 9,
  minute: 0,
  leadDays: PERIOD_REMINDER_LEAD_DAYS,
  period: true,
  fertility: true,
  daily: false,
  endCheck: false,
};

/** Dates use calendar arithmetic, including across DST. At most 31 slots per planning pass. */
export function planCycleReminders(
  timeline: CycleTimeline,
  nowMs: number,
  options: {
    preferences?: CycleReminderPreferences;
    activePeriod?: CyclePeriodInput | null;
    backupDays?: number;
    lastBackup?: number | null;
  } = {}
): CycleReminder[] {
  const prefs = options.preferences ?? DEFAULT_CYCLE_REMINDERS;
  const atTime = (ms: number) => {
    const date = new Date(ms);
    date.setHours(prefs.hour, prefs.minute, 0, 0);
    return date;
  };

  const reminders: CycleReminder[] = [];
  const { prediction } = timeline;
  if ((prediction.state === 'upcoming' || prediction.state === 'window') && prediction.earliest) {
    if (prefs.period) {
      reminders.push({
        kind: 'period-start',
        date: atTime(addCalendarDays(prediction.earliest, -prefs.leadDays)),
      });
    }

    if (prefs.fertility && timeline.fertileEstimate) {
      reminders.push({ kind: 'fertile-window', date: atTime(timeline.fertileEstimate.start) });
    }
  }

  const nextTime = atTime(nowMs).getTime() > nowMs ? nowMs : addCalendarDays(nowMs, 1);
  if (prefs.daily) {
    for (let i = 0; i < 28; i++) {
      reminders.push({ kind: 'daily-log', date: atTime(addCalendarDays(nextTime, i)) });
    }
  }

  if (prefs.endCheck && options.activePeriod?.endDate == null && options.activePeriod) {
    const check = atTime(addCalendarDays(options.activePeriod.startDate, 7));
    reminders.push({ kind: 'end-check', date: check.getTime() > nowMs ? check : atTime(nextTime) });
  }

  if ((options.backupDays ?? 0) > 0) {
    const due = atTime(
      addCalendarDays(options.lastBackup ?? nowMs, options.lastBackup ? options.backupDays! : 0)
    );
    reminders.push({ kind: 'backup', date: due.getTime() > nowMs ? due : atTime(nextTime) });
  }

  return reminders.filter((r) => r.date.getTime() > nowMs);
}
