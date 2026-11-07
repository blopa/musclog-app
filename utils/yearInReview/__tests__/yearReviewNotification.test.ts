import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/utils/notificationPolicy';
import { planYearReviewNotification } from '@/utils/yearInReview/yearReviewNotification';

const PREFS: NotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
const HAS_SESSIONS = { dismissedYear: null, hasSessions: true };

const at = (month: number, day: number, hour: number, minute = 0) =>
  new Date(2026, month, day, hour, minute, 0, 0);

describe('planYearReviewNotification', () => {
  it('plans 1 December at 18:00 from late November', () => {
    const plan = planYearReviewNotification(at(10, 30, 10), PREFS, HAS_SESSIONS);

    expect(plan).toEqual({ date: at(11, 1, 18), year: 2026 });
  });

  it('still plans it on 1 December before 18:00', () => {
    expect(planYearReviewNotification(at(11, 1, 17, 59), PREFS, HAS_SESSIONS)?.date).toEqual(
      at(11, 1, 18)
    );
  });

  it('never fires late: at or after 18:00 on 1 December there is nothing to plan', () => {
    expect(planYearReviewNotification(at(11, 1, 18), PREFS, HAS_SESSIONS)).toBeNull();
    expect(planYearReviewNotification(at(11, 1, 18, 1), PREFS, HAS_SESSIONS)).toBeNull();
  });

  it('plans nothing outside November and December', () => {
    expect(planYearReviewNotification(at(5, 15, 10), PREFS, HAS_SESSIONS)).toBeNull();
    expect(planYearReviewNotification(at(0, 3, 10), PREFS, HAS_SESSIONS)).toBeNull();
  });

  it('does not plan a year the user dismissed', () => {
    expect(
      planYearReviewNotification(at(10, 30, 10), PREFS, { dismissedYear: 2026, hasSessions: true })
    ).toBeNull();
  });

  it('does not plan a year with no completed sessions', () => {
    expect(
      planYearReviewNotification(at(10, 30, 10), PREFS, { dismissedYear: null, hasSessions: false })
    ).toBeNull();
  });

  it('is silenced by a pause that covers the fire time', () => {
    const paused = { ...PREFS, pausedUntil: at(11, 2, 0).getTime() };

    expect(planYearReviewNotification(at(10, 30, 10), paused, HAS_SESSIONS)).toBeNull();
  });

  it('is silenced by quiet hours that cover the fire time', () => {
    const quiet = {
      ...PREFS,
      quietHoursEnabled: true,
      quietStart: '17:00',
      quietEnd: '19:00',
    };

    expect(planYearReviewNotification(at(10, 30, 10), quiet, HAS_SESSIONS)).toBeNull();
  });

  it('is not sent to someone the comeback back-off has gone quiet', () => {
    expect(
      planYearReviewNotification(at(10, 30, 10), PREFS, { ...HAS_SESSIONS, backOff: true })
    ).toBeNull();
  });
});
