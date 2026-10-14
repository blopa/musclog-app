import { jsDayToWeekdayIndex } from '@/utils/weekdays';

/**
 * Everything that decides WHETHER and WHEN an offline notification may fire, kept pure so it runs in
 * the Jest `node` project. There is no server: every reminder is a local schedule that the app
 * re-plans on boot, on foreground and after a workout, so the rules below are applied at planning
 * time, never at delivery time.
 */

export const ACCOUNTABILITY_STYLES = ['structured', 'gentle', 'flexible'] as const;
export type AccountabilityStyle = (typeof ACCOUNTABILITY_STYLES)[number];

export const LOCK_SCREEN_DETAILS = ['full', 'minimal'] as const;
export type LockScreenDetail = (typeof LOCK_SCREEN_DETAILS)[number];

export const REMINDER_LEAD_MINUTES = [0, 15, 30, 60] as const;
export type ReminderLeadMinutes = (typeof REMINDER_LEAD_MINUTES)[number];

/** How often the persistent workout notification's clock is re-posted. */
export const ACTIVE_WORKOUT_UPDATE_SECONDS = [5, 10, 15, 30, 60] as const;
export type ActiveWorkoutUpdateSeconds = (typeof ACTIVE_WORKOUT_UPDATE_SECONDS)[number];

/**
 * The clock text for the persistent notification, rounded DOWN to the update step, so the text only
 * changes (and the notification is only re-posted) once per step. With 60 the seconds read `00`.
 */
export function activeWorkoutClock(
  hours: number,
  minutes: number,
  seconds: number,
  step: ActiveWorkoutUpdateSeconds
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const rounded = step >= 60 ? 0 : Math.floor(seconds / step) * step;
  return `${pad(hours)}:${pad(minutes)}:${pad(rounded)}`;
}

export const PAUSE_DAY_OPTIONS = [3, 7] as const;

export interface NotificationPreferences {
  quietHoursEnabled: boolean;
  /** `HH:mm`, local. The window may cross midnight (22:00 → 07:00). */
  quietStart: string;
  quietEnd: string;
  /** Epoch ms until which everything except the live session is silenced; null = not paused. */
  pausedUntil: number | null;
  /** Minutes before a planned workout's time that its reminder fires. */
  reminderLeadMinutes: ReminderLeadMinutes;
  accountability: AccountabilityStyle;
  /** "Did you forget to finish and log your workout?" after the last saved set. */
  unfinishedWorkout: boolean;
  /** "N workouts left this week", only when the weekly consistency goal is slipping. */
  goalAtRisk: boolean;
  /** Fire the rest alert a second time a minute later if the user has not come back. */
  restTimerRepeat: boolean;
  lockScreenDetail: LockScreenDetail;
  activeWorkoutUpdateSeconds: ActiveWorkoutUpdateSeconds;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  pausedUntil: null,
  reminderLeadMinutes: 0,
  accountability: 'structured',
  unfinishedWorkout: false,
  goalAtRisk: false,
  restTimerRepeat: false,
  lockScreenDetail: 'full',
  activeWorkoutUpdateSeconds: 5,
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseClockTime(value: string): { hours: number; minutes: number } | null {
  const match = TIME_PATTERN.exec(value);
  return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null;
}

export function formatClockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function pick<T extends string | number>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clock(value: unknown, fallback: string): string {
  return typeof value === 'string' && parseClockTime(value) ? value : fallback;
}

/** Reads the stored JSON, field by field, so a hand-edited or newer-version value degrades to a default. */
export function parseNotificationPreferences(
  raw: string | null | undefined
): NotificationPreferences {
  const defaults = DEFAULT_NOTIFICATION_PREFERENCES;
  if (!raw) {
    return { ...defaults };
  }

  let parsed: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ...defaults };
    }

    parsed = value as Record<string, unknown>;
  } catch {
    return { ...defaults };
  }

  const pausedUntil = parsed['pausedUntil'];

  return {
    quietHoursEnabled: bool(parsed['quietHoursEnabled'], defaults.quietHoursEnabled),
    quietStart: clock(parsed['quietStart'], defaults.quietStart),
    quietEnd: clock(parsed['quietEnd'], defaults.quietEnd),
    pausedUntil:
      typeof pausedUntil === 'number' && Number.isFinite(pausedUntil) ? pausedUntil : null,
    reminderLeadMinutes: pick(REMINDER_LEAD_MINUTES, parsed['reminderLeadMinutes'], 0),
    accountability: pick(ACCOUNTABILITY_STYLES, parsed['accountability'], defaults.accountability),
    unfinishedWorkout: bool(parsed['unfinishedWorkout'], defaults.unfinishedWorkout),
    goalAtRisk: bool(parsed['goalAtRisk'], defaults.goalAtRisk),
    restTimerRepeat: bool(parsed['restTimerRepeat'], defaults.restTimerRepeat),
    lockScreenDetail: pick(LOCK_SCREEN_DETAILS, parsed['lockScreenDetail'], 'full'),
    activeWorkoutUpdateSeconds: pick(
      ACTIVE_WORKOUT_UPDATE_SECONDS,
      parsed['activeWorkoutUpdateSeconds'],
      defaults.activeWorkoutUpdateSeconds
    ),
  };
}

export function isPaused(date: Date, prefs: NotificationPreferences): boolean {
  return prefs.pausedUntil !== null && date.getTime() < prefs.pausedUntil;
}

export function isInQuietHours(date: Date, prefs: NotificationPreferences): boolean {
  if (!prefs.quietHoursEnabled) {
    return false;
  }

  const start = parseClockTime(prefs.quietStart);
  const end = parseClockTime(prefs.quietEnd);
  if (!start || !end) {
    return false;
  }

  const minute = date.getHours() * 60 + date.getMinutes();
  const from = start.hours * 60 + start.minutes;
  const to = end.hours * 60 + end.minutes;
  if (from === to) {
    return false;
  }

  return from < to ? minute >= from && minute < to : minute >= from || minute < to;
}

/**
 * Whether a notification that is NOT part of a live workout may fire at `date`. A rest alert, the
 * active-workout banner and the unfinished-workout nudge are deliberately exempt: the user started
 * that session themselves, and silencing them at 22:30 would break the workout, not protect sleep.
 */
export function isSuppressed(date: Date, prefs: NotificationPreferences): boolean {
  return isPaused(date, prefs) || isInQuietHours(date, prefs);
}

/** The day at `time`, minus the lead. Returns null for an unreadable time. */
export function reminderFireDate(day: Date, time: string, leadMinutes: number): Date | null {
  const parsed = parseClockTime(time);
  if (!parsed) {
    return null;
  }

  const fire = new Date(day);
  fire.setHours(parsed.hours, parsed.minutes - leadMinutes, 0, 0);
  return fire;
}

export interface PlannedReminderSource {
  templateId: string;
  planId?: string;
  /** Monday-first, 0–6. */
  dayIndex: number;
  reminderTime: string;
}

export interface PlannedReminder {
  date: Date;
  templateId: string;
  planId?: string;
}

/** How far ahead reminders are laid out. iOS keeps 64 pending notifications per app, shared with every other kind. */
export const WORKOUT_REMINDER_HORIZON_DAYS = 14;

/**
 * Lays planned workouts out as one-off reminders over the next `horizonDays`, instead of a repeating
 * weekly trigger. A repeating trigger cannot skip today because the workout is already done, honour a
 * pause, or step out of quiet hours; one-offs can, and they are re-planned whenever the app opens or
 * a workout ends.
 *
 * `completedTemplateIdsToday` removes today's reminder for a workout already finished today.
 */
export function planWorkoutReminders(input: {
  now: Date;
  sources: readonly PlannedReminderSource[];
  prefs: NotificationPreferences;
  completedTemplateIdsToday: ReadonlySet<string>;
  horizonDays?: number;
}): PlannedReminder[] {
  const { now, sources, prefs, completedTemplateIdsToday } = input;
  const horizon = input.horizonDays ?? WORKOUT_REMINDER_HORIZON_DAYS;
  if (prefs.accountability !== 'structured') {
    return [];
  }

  const planned: PlannedReminder[] = [];
  for (let offset = 0; offset < horizon; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayIndex = jsDayToWeekdayIndex(day.getDay());

    for (const source of sources) {
      if (source.dayIndex !== dayIndex) {
        continue;
      }

      if (offset === 0 && completedTemplateIdsToday.has(source.templateId)) {
        continue;
      }

      const date = reminderFireDate(day, source.reminderTime, prefs.reminderLeadMinutes);
      if (!date || date.getTime() <= now.getTime() || isSuppressed(date, prefs)) {
        continue;
      }

      planned.push({ date, templateId: source.templateId, planId: source.planId });
    }
  }

  return planned.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Monday 00:00 local of the week containing `date`, and the number of days left in it including today. */
export function calendarWeekBounds(date: Date): { start: Date; end: Date; daysLeft: number } {
  const dayIndex = jsDayToWeekdayIndex(date.getDay());
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayIndex);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start, end, daysLeft: 7 - dayIndex };
}

/**
 * The weekly consistency goal is "at risk" once the sessions still owed no longer fit comfortably in
 * the days left: remaining ≥ days left − 1 leaves at most one spare day. Plenty of time, or an
 * already-met goal, never nudges.
 */
export function goalAtRiskRemaining(input: {
  goalPerWeek: number | null;
  doneThisWeek: number;
  daysLeft: number;
}): number | null {
  const { goalPerWeek, doneThisWeek, daysLeft } = input;
  if (!goalPerWeek || goalPerWeek <= 0) {
    return null;
  }

  const remaining = goalPerWeek - doneThisWeek;
  return remaining > 0 && remaining >= daysLeft - 1 ? remaining : null;
}

export const GOAL_AT_RISK_HOUR = 18;

/** Today at 18:00 if still ahead, otherwise tomorrow — null once that falls past the end of the week. */
export function goalAtRiskFireDate(now: Date, weekEnd: Date): Date | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), GOAL_AT_RISK_HOUR);
  const fire =
    today.getTime() > now.getTime()
      ? today
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, GOAL_AT_RISK_HOUR);

  return fire.getTime() < weekEnd.getTime() ? fire : null;
}

export const NUTRITION_OVERVIEW_HOUR = 21;
export const NUTRITION_OVERVIEW_HORIZON_DAYS = 7;

/** The nightly overview as one-offs, so a pause or quiet hours can drop individual evenings. */
export function planNutritionOverview(now: Date, prefs: NotificationPreferences): Date[] {
  const dates: Date[] = [];
  for (let offset = 0; offset < NUTRITION_OVERVIEW_HORIZON_DAYS; offset += 1) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      NUTRITION_OVERVIEW_HOUR
    );
    if (date.getTime() > now.getTime() && !isSuppressed(date, prefs)) {
      dates.push(date);
    }
  }

  return dates;
}

/** Minutes after the last saved set before "you forgot to finish" fires. */
export const UNFINISHED_WORKOUT_DELAY_MINUTES = 45;

export const SNOOZE_MINUTES = 60;
export const REST_ADD_SECONDS = 30;
export const REST_REPEAT_DELAY_SECONDS = 60;
