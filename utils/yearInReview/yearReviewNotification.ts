import { isSuppressed, type NotificationPreferences } from '@/utils/notificationPolicy';

/** The notification fires at 18:00 on 1 December, the day the season opens. */
export const YEAR_REVIEW_NOTIFICATION_HOUR = 18;
const DECEMBER = 11;
const NOVEMBER = 10;

export interface YearReviewNotificationInput {
  /** The year the planned notification is about, when it has been dismissed. */
  dismissedYear: number | null;
  /** Whether the year being reviewed has at least one completed session. */
  hasSessions: boolean;
  /** Comeback back-off: a user who has gone quiet is not sent a year-end nudge. */
  backOff?: boolean;
}

export interface PlannedYearReview {
  date: Date;
  year: number;
}

/**
 * The one date to announce the year-end review, or null. It is planned only in November and
 * December, for 1 December 18:00 of the current year. It never fires late: once that moment has
 * passed (or while the season is already open and the notice was missed) nothing is planned.
 */
export function planYearReviewNotification(
  now: Date,
  prefs: NotificationPreferences,
  input: YearReviewNotificationInput
): PlannedYearReview | null {
  const month = now.getMonth();
  if (month !== NOVEMBER && month !== DECEMBER) {
    return null;
  }

  const year = now.getFullYear();
  const date = new Date(year, DECEMBER, 1, YEAR_REVIEW_NOTIFICATION_HOUR, 0, 0, 0);
  if (date.getTime() <= now.getTime()) {
    return null;
  }

  if (input.dismissedYear === year || !input.hasSessions || input.backOff) {
    return null;
  }

  if (isSuppressed(date, prefs)) {
    return null;
  }

  return { date, year };
}
