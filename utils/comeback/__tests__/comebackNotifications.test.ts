import {
  COMEBACK_WELCOME_HOUR,
  planWelcomeBackNudge,
  shouldBackOffReminders,
} from '@/utils/comeback/comebackNotifications';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/utils/notificationPolicy';

const prefs = (patch: Partial<NotificationPreferences> = {}): NotificationPreferences => ({
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  ...patch,
});

const DAY = 24 * 60 * 60 * 1000;
// Wednesday 14 Oct 2026, 10:00 local.
const NOW = new Date(2026, 9, 14, 10, 0, 0).getTime();
const context = (patch: Partial<Parameters<typeof shouldBackOffReminders>[0]> = {}) => ({
  lastActivityAt: NOW - 3 * DAY,
  comebackActive: false,
  now: NOW,
  ...patch,
});

describe('shouldBackOffReminders', () => {
  it('stays off while the person is recently active', () => {
    expect(shouldBackOffReminders(context({ lastActivityAt: NOW - 13 * DAY }))).toBe(false);
  });

  it('turns on at the 14-day gap', () => {
    expect(shouldBackOffReminders(context({ lastActivityAt: NOW - 14 * DAY }))).toBe(true);
    expect(shouldBackOffReminders(context({ lastActivityAt: NOW - 90 * DAY }))).toBe(true);
  });

  it('never applies during a comeback, which has its own cadence', () => {
    expect(
      shouldBackOffReminders(context({ lastActivityAt: NOW - 90 * DAY, comebackActive: true }))
    ).toBe(false);
  });

  it('never applies to someone who has logged nothing at all', () => {
    expect(shouldBackOffReminders(context({ lastActivityAt: null }))).toBe(false);
  });
});

describe('planWelcomeBackNudge', () => {
  it('lands at 18:00 on the day the gap reaches 14 days', () => {
    const last = new Date(2026, 9, 10, 9, 30).getTime();
    const date = planWelcomeBackNudge(context({ lastActivityAt: last }), prefs());
    expect(date).toEqual(new Date(2026, 9, 24, COMEBACK_WELCOME_HOUR, 0, 0));
  });

  it('plans nothing once that moment has passed: Home makes the offer instead', () => {
    expect(planWelcomeBackNudge(context({ lastActivityAt: NOW - 30 * DAY }), prefs())).toBeNull();
  });

  it('plans nothing during a comeback or without any activity', () => {
    expect(planWelcomeBackNudge(context({ comebackActive: true }), prefs())).toBeNull();
    expect(planWelcomeBackNudge(context({ lastActivityAt: null }), prefs())).toBeNull();
  });

  it('respects the flexible accountability style, pauses and quiet hours', () => {
    const last = new Date(2026, 9, 10, 9, 30).getTime();
    expect(
      planWelcomeBackNudge(context({ lastActivityAt: last }), prefs({ accountability: 'flexible' }))
    ).toBeNull();
    expect(
      planWelcomeBackNudge(
        context({ lastActivityAt: last }),
        prefs({ pausedUntil: new Date(2026, 9, 30).getTime() })
      )
    ).toBeNull();
    expect(
      planWelcomeBackNudge(
        context({ lastActivityAt: last }),
        prefs({ quietHoursEnabled: true, quietStart: '17:00', quietEnd: '08:00' })
      )
    ).toBeNull();
  });
});
