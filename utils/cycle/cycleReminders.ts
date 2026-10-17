import { PERIOD_REMINDER_LEAD_DAYS } from '@/constants/cycle';

import type { CycleTimeline } from './cycleTimeline';
import { addCalendarDays } from './dates';
import type { CyclePeriodInput, CycleReminderPreferences, PillSchedule } from './types';

export type CycleReminderKind =
  | 'period-start'
  | 'period-due'
  | 'period-late'
  | 'fertile-window'
  | 'daily-log'
  | 'end-check'
  | 'backup'
  | 'pill';

/** Ordered for settings and previews: estimates first, then routines the person scheduled. */
export const CYCLE_REMINDER_KINDS: readonly CycleReminderKind[] = [
  'period-start',
  'period-due',
  'period-late',
  'fertile-window',
  'pill',
  'daily-log',
  'end-check',
  'backup',
];

export function isCycleReminderKind(value: string): value is CycleReminderKind {
  return (CYCLE_REMINDER_KINDS as readonly string[]).includes(value);
}

/**
 * Where a reminder's date comes from. A prediction is an estimate from the person's own cycles; a
 * routine is a time they chose. Settings and the "why did I get this?" sheet both say which.
 */
export const CYCLE_REMINDER_BASIS: Record<CycleReminderKind, 'estimate' | 'routine'> = {
  'period-start': 'estimate',
  'period-due': 'estimate',
  'period-late': 'estimate',
  'fertile-window': 'estimate',
  pill: 'routine',
  'daily-log': 'routine',
  'end-check': 'routine',
  backup: 'routine',
};

/**
 * Reminders a pause does not silence. A pill reminder is an adherence tool the person relies on;
 * pausing "the cycle notifications" while grieving or travelling must not make them miss a pill.
 */
export const PAUSE_EXEMPT: ReadonlySet<CycleReminderKind> = new Set(['pill']);

export interface CycleReminder {
  kind: CycleReminderKind;
  /** The first (or only) time it fires. */
  date: Date;
  /** Fires every day at `date`'s time: one OS slot instead of a month of one-shot reminders. */
  repeatsDaily?: boolean;
  /** For the wording: the estimated range or day the reminder is about. */
  range?: { from: number; to: number };
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

/** Days of one-shot pill reminders planned ahead; renewed whenever the app comes to the foreground. */
export const PILL_HORIZON_DAYS = 28;

export const DEFAULT_PILL_SCHEDULE: Omit<PillSchedule, 'packStart'> = {
  enabled: true,
  hour: 21,
  minute: 0,
  activeDays: 21,
  breakDays: 7,
};

/** Whether a pause is in force at `nowMs`. `until: null` pauses until the person resumes. */
export function isPaused(prefs: CycleReminderPreferences, nowMs: number): boolean {
  const pause = prefs.pause;

  return pause != null && (pause.until == null || pause.until > nowMs);
}

/** Whether `day` is a pill-taking day of the schedule (not a pill-free day). */
export function isPillDay(schedule: PillSchedule, day: number): boolean {
  if (schedule.breakDays === 0) {
    return day >= schedule.packStart;
  }

  const length = schedule.activeDays + schedule.breakDays;
  const offset = Math.round((day - schedule.packStart) / 86_400_000);
  if (offset < 0) {
    return false;
  }

  return offset % length < schedule.activeDays;
}

/**
 * Every cycle reminder that should be scheduled now, in one pure pass. Predictions only exist for
 * an estimate the screen would show (the timeline already folds in the context: hormonal methods,
 * pregnancy, a loss, no-bleeding tracking), so changing the context cancels them on the next
 * reschedule. Dates use calendar arithmetic, so they survive a DST change.
 */
export function planCycleReminders(
  timeline: CycleTimeline | null,
  nowMs: number,
  options: {
    preferences?: CycleReminderPreferences;
    activePeriod?: CyclePeriodInput | null;
    backupDays?: number;
    lastBackup?: number | null;
  } = {}
): CycleReminder[] {
  const prefs = { ...DEFAULT_CYCLE_REMINDERS, ...options.preferences };
  const atTime = (ms: number, hour = prefs.hour, minute = prefs.minute) => {
    const date = new Date(ms);
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const nextAt = (hour: number, minute: number) =>
    atTime(nowMs, hour, minute).getTime() > nowMs
      ? atTime(nowMs, hour, minute)
      : atTime(addCalendarDays(nowMs, 1), hour, minute);

  const reminders: CycleReminder[] = [];
  const prediction = timeline?.prediction;
  if (
    prediction &&
    (prediction.state === 'upcoming' || prediction.state === 'window') &&
    prediction.earliest != null &&
    prediction.latest != null
  ) {
    const range = { from: prediction.earliest, to: prediction.latest };
    if (prefs.period) {
      reminders.push({
        kind: 'period-start',
        date: atTime(addCalendarDays(prediction.earliest, -prefs.leadDays)),
        range,
      });
    }

    if (prefs.due && prediction.mostLikely != null) {
      reminders.push({ kind: 'period-due', date: atTime(prediction.mostLikely), range });
    }

    // The day after the latest plausible start: "longer than your recent pattern", never "late".
    if (prefs.late) {
      reminders.push({
        kind: 'period-late',
        date: atTime(addCalendarDays(prediction.latest, 1)),
        range,
      });
    }

    if (prefs.fertility && timeline?.fertileEstimate) {
      reminders.push({
        kind: 'fertile-window',
        date: atTime(timeline.fertileEstimate.start),
        range: { from: timeline.fertileEstimate.start, to: timeline.fertileEstimate.end },
      });
    }
  }

  if (prefs.daily) {
    reminders.push({
      kind: 'daily-log',
      date: nextAt(prefs.hour, prefs.minute),
      repeatsDaily: true,
    });
  }

  if (prefs.endCheck && options.activePeriod && options.activePeriod.endDate == null) {
    const check = atTime(addCalendarDays(options.activePeriod.startDate, 7));
    reminders.push({
      kind: 'end-check',
      date: check.getTime() > nowMs ? check : nextAt(prefs.hour, prefs.minute),
    });
  }

  if ((options.backupDays ?? 0) > 0) {
    const due = atTime(
      addCalendarDays(options.lastBackup ?? nowMs, options.lastBackup ? options.backupDays! : 0)
    );
    reminders.push({
      kind: 'backup',
      date: due.getTime() > nowMs ? due : nextAt(prefs.hour, prefs.minute),
    });
  }

  const pill = prefs.pill;
  if (pill?.enabled) {
    if (pill.breakDays === 0 && pill.packStart <= nowMs) {
      reminders.push({ kind: 'pill', date: nextAt(pill.hour, pill.minute), repeatsDaily: true });
    } else {
      for (let i = 0; i <= PILL_HORIZON_DAYS; i++) {
        const day = addCalendarDays(new Date(nowMs).setHours(0, 0, 0, 0), i);
        if (isPillDay(pill, day)) {
          reminders.push({ kind: 'pill', date: atTime(day, pill.hour, pill.minute) });
        }
      }
    }
  }

  const paused = isPaused(prefs, nowMs);
  const pauseEnd = prefs.pause?.until ?? Number.POSITIVE_INFINITY;

  return reminders.filter((r) => {
    if (r.date.getTime() <= nowMs) {
      return false;
    }

    if (!paused || PAUSE_EXEMPT.has(r.kind)) {
      return true;
    }

    // A repeating reminder cannot start later, so a paused one waits for the next reschedule
    // after the pause ends (every app foreground); a one-shot after the pause is kept.
    return !r.repeatsDaily && r.date.getTime() > pauseEnd;
  });
}

/** The soonest reminder that will fire, for the settings' "next reminder" line. */
export function nextReminder(reminders: CycleReminder[]): CycleReminder | null {
  return reminders.reduce<CycleReminder | null>(
    (soonest, r) => (!soonest || r.date.getTime() < soonest.date.getTime() ? r : soonest),
    null
  );
}

/** "Later" on a pill reminder: soon enough to still be the same dose window. */
export const PILL_LATER_MINUTES = 30;
/** "Snooze" on any other cycle reminder. */
export const CYCLE_SNOOZE_MINUTES = 60;

/** The one answer a pill reminder's buttons record on the day; the diary shows it as ordinary data. */
export type PillAnswer = 'taken' | 'skipped';

/**
 * Whether a snoozed copy of a reminder may still fire. A snooze outlives the reschedule that
 * ordinary reminders are replaced by, so it has to be re-checked against what the plan would say
 * now: a pause silences everything but the pill, and an estimate (a period or a fertile window)
 * must not be repeated after a context change — pregnancy, a loss, a hormonal method — has taken
 * the prediction away. A routine the person scheduled (daily check-in, backup, pill) has no such
 * dependency.
 */
export function isSnoozeStillValid(
  kind: CycleReminderKind,
  state: {
    timeline: CycleTimeline | null;
    preferences?: CycleReminderPreferences;
    nowMs: number;
  }
): boolean {
  const prefs = { ...DEFAULT_CYCLE_REMINDERS, ...state.preferences };
  if (isPaused(prefs, state.nowMs) && !PAUSE_EXEMPT.has(kind)) {
    return false;
  }

  if (CYCLE_REMINDER_BASIS[kind] === 'routine') {
    return true;
  }

  const predictionState = state.timeline?.prediction.state;
  if (
    predictionState !== 'upcoming' &&
    predictionState !== 'window' &&
    predictionState !== 'late'
  ) {
    return false;
  }

  return kind === 'fertile-window' ? prefs.fertility : true;
}
