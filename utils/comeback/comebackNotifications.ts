import { differenceInCalendarDays } from 'date-fns';

import { COMEBACK_OFFER_MIN_GAP_DAYS } from '@/utils/comeback/lapse';
import { addCalendarDays } from '@/utils/cycle/dates';
import { isSuppressed, type NotificationPreferences } from '@/utils/notificationPolicy';

/**
 * When reminders go quiet for someone who has drifted away, and the one nudge that welcomes them
 * back. Pure: `refreshAllNotifications` reads the activity and the comeback state once and hands the
 * facts in, so the planners themselves never touch either.
 */

/** Local hour of the single welcome-back nudge. */
export const COMEBACK_WELCOME_HOUR = 18;

export type ComebackReminderContext = {
  /** Latest workout, food log or weigh-in, ms; null = the person never logged anything. */
  lastActivityAt: number | null;
  /** A comeback is running, so its own cadence replaces the back-off. */
  comebackActive: boolean;
  now: number;
};

/**
 * Whether workout reminders, the weekly-goal warning and the nightly overview should stay silent.
 * Reminders that keep firing into weeks of silence read as nagging, and they never change tone; after
 * two weeks without activity they stop, until the person is active again or starts a comeback.
 */
export function shouldBackOffReminders(context: ComebackReminderContext): boolean {
  if (context.comebackActive || context.lastActivityAt === null) {
    return false;
  }

  return (
    differenceInCalendarDays(context.now, context.lastActivityAt) >= COMEBACK_OFFER_MIN_GAP_DAYS
  );
}

/**
 * The one welcome-back nudge for a gap: the day the gap reaches the offer threshold, in the evening.
 * It is laid out ahead of time, from the last activity, because the person is by definition not
 * opening the app. `null` when it is not wanted: a comeback is running, the gap is already past (the
 * Home card makes the offer instead), the style is `flexible`, or it would land in quiet hours or a
 * pause.
 */
export function planWelcomeBackNudge(
  context: ComebackReminderContext,
  prefs: NotificationPreferences
): Date | null {
  if (
    context.comebackActive ||
    context.lastActivityAt === null ||
    prefs.accountability === 'flexible'
  ) {
    return null;
  }

  const day = new Date(addCalendarDays(context.lastActivityAt, COMEBACK_OFFER_MIN_GAP_DAYS));
  const fire = new Date(day.getFullYear(), day.getMonth(), day.getDate(), COMEBACK_WELCOME_HOUR);

  return fire.getTime() > context.now && !isSuppressed(fire, prefs) ? fire : null;
}
