import {
  activeWorkoutClock,
  calendarWeekBounds,
  DEFAULT_NOTIFICATION_PREFERENCES,
  goalAtRiskFireDate,
  goalAtRiskRemaining,
  isInQuietHours,
  isSuppressed,
  type NotificationPreferences,
  parseNotificationPreferences,
  planNutritionOverview,
  planWorkoutReminders,
} from '@/utils/notificationPolicy';

const prefs = (patch: Partial<NotificationPreferences> = {}): NotificationPreferences => ({
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  ...patch,
});

// Wednesday 14 Oct 2026, 10:00 local.
const NOW = new Date(2026, 9, 14, 10, 0, 0);

describe('parseNotificationPreferences', () => {
  it('falls back to defaults for empty, broken or non-object input', () => {
    expect(parseNotificationPreferences('')).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(parseNotificationPreferences('{nope')).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(parseNotificationPreferences('[1]')).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it('keeps valid fields and drops each invalid one individually', () => {
    const parsed = parseNotificationPreferences(
      JSON.stringify({
        quietHoursEnabled: true,
        quietStart: '25:00',
        quietEnd: '06:30',
        reminderLeadMinutes: 45,
        accountability: 'gentle',
        pausedUntil: 'tomorrow',
      })
    );

    expect(parsed.quietHoursEnabled).toBe(true);
    expect(parsed.quietStart).toBe('22:00');
    expect(parsed.quietEnd).toBe('06:30');
    expect(parsed.reminderLeadMinutes).toBe(0);
    expect(parsed.accountability).toBe('gentle');
    expect(parsed.pausedUntil).toBeNull();
  });
});

describe('quiet hours and pause', () => {
  it('handles a window that crosses midnight', () => {
    const quiet = prefs({ quietHoursEnabled: true });
    expect(isInQuietHours(new Date(2026, 9, 14, 23, 0), quiet)).toBe(true);
    expect(isInQuietHours(new Date(2026, 9, 14, 6, 59), quiet)).toBe(true);
    expect(isInQuietHours(new Date(2026, 9, 14, 7, 0), quiet)).toBe(false);
    expect(isInQuietHours(new Date(2026, 9, 14, 12, 0), quiet)).toBe(false);
  });

  it('is never quiet when disabled', () => {
    expect(isInQuietHours(new Date(2026, 9, 14, 23, 0), prefs())).toBe(false);
  });

  it('suppresses everything until the pause ends', () => {
    const paused = prefs({ pausedUntil: NOW.getTime() + 3600_000 });
    expect(isSuppressed(NOW, paused)).toBe(true);
    expect(isSuppressed(new Date(NOW.getTime() + 2 * 3600_000), paused)).toBe(false);
  });
});

describe('planWorkoutReminders', () => {
  // Wednesday is index 2 (Monday-first).
  const sources = [
    { templateId: 'push', dayIndex: 2, reminderTime: '18:00' },
    { templateId: 'pull', dayIndex: 4, reminderTime: '09:00' },
  ];

  it('lays one-off reminders over the horizon, in order', () => {
    const planned = planWorkoutReminders({
      now: NOW,
      sources,
      prefs: prefs(),
      completedTemplateIdsToday: new Set(),
    });

    expect(planned.map((reminder) => reminder.templateId)).toEqual([
      'push',
      'pull',
      'push',
      'pull',
    ]);
    expect(planned[0].date).toEqual(new Date(2026, 9, 14, 18, 0));
  });

  it("skips today's reminder for a workout already finished today", () => {
    const planned = planWorkoutReminders({
      now: NOW,
      sources,
      prefs: prefs(),
      completedTemplateIdsToday: new Set(['push']),
    });

    expect(planned[0].templateId).toBe('pull');
    expect(planned.filter((reminder) => reminder.templateId === 'push')).toHaveLength(1);
  });

  it('applies the lead time and drops reminders that are already past', () => {
    const planned = planWorkoutReminders({
      now: new Date(2026, 9, 14, 17, 45),
      sources,
      prefs: prefs({ reminderLeadMinutes: 30 }),
      completedTemplateIdsToday: new Set(),
    });

    // 17:30 has passed, so today's push reminder is gone; next Wednesday's is 17:30.
    expect(planned.filter((reminder) => reminder.templateId === 'push')).toHaveLength(1);
    expect(planned.find((reminder) => reminder.templateId === 'push')?.date).toEqual(
      new Date(2026, 9, 21, 17, 30)
    );
  });

  it('drops reminders inside quiet hours and plans nothing for non-structured accountability', () => {
    const quiet = planWorkoutReminders({
      now: NOW,
      sources: [{ templateId: 'late', dayIndex: 2, reminderTime: '23:00' }],
      prefs: prefs({ quietHoursEnabled: true }),
      completedTemplateIdsToday: new Set(),
    });
    expect(quiet).toEqual([]);

    for (const accountability of ['gentle', 'flexible'] as const) {
      expect(
        planWorkoutReminders({
          now: NOW,
          sources,
          prefs: prefs({ accountability }),
          completedTemplateIdsToday: new Set(),
        })
      ).toEqual([]);
    }
  });
});

describe('weekly goal at risk', () => {
  it('measures the calendar week Monday to Sunday', () => {
    const week = calendarWeekBounds(NOW);
    expect(week.start).toEqual(new Date(2026, 9, 12));
    expect(week.end).toEqual(new Date(2026, 9, 19));
    expect(week.daysLeft).toBe(5);
  });

  it('nudges only when the remaining sessions barely fit the days left', () => {
    expect(goalAtRiskRemaining({ goalPerWeek: 4, doneThisWeek: 0, daysLeft: 5 })).toBe(4);
    expect(goalAtRiskRemaining({ goalPerWeek: 3, doneThisWeek: 0, daysLeft: 7 })).toBeNull();
    expect(goalAtRiskRemaining({ goalPerWeek: 3, doneThisWeek: 3, daysLeft: 2 })).toBeNull();
    expect(goalAtRiskRemaining({ goalPerWeek: null, doneThisWeek: 0, daysLeft: 1 })).toBeNull();
  });

  it('fires at 18:00 today, else tomorrow, and never past the end of the week', () => {
    const weekEnd = new Date(2026, 9, 19);
    expect(goalAtRiskFireDate(NOW, weekEnd)).toEqual(new Date(2026, 9, 14, 18));
    expect(goalAtRiskFireDate(new Date(2026, 9, 14, 19), weekEnd)).toEqual(
      new Date(2026, 9, 15, 18)
    );
    expect(goalAtRiskFireDate(new Date(2026, 9, 18, 19), weekEnd)).toBeNull();
  });
});

describe('planNutritionOverview', () => {
  it('plans the coming evenings and skips a paused one', () => {
    expect(planNutritionOverview(NOW, prefs())).toHaveLength(7);

    const paused = planNutritionOverview(
      NOW,
      prefs({ pausedUntil: new Date(2026, 9, 16, 12).getTime() })
    );
    expect(paused[0]).toEqual(new Date(2026, 9, 16, 21));
    expect(paused).toHaveLength(5);
  });
});

describe('activeWorkoutClock', () => {
  it('rounds seconds down to the update step so the text changes once per step', () => {
    expect(activeWorkoutClock(0, 12, 37, 5)).toBe('00:12:35');
    expect(activeWorkoutClock(1, 2, 59, 15)).toBe('01:02:45');
    expect(activeWorkoutClock(0, 0, 29, 30)).toBe('00:00:00');
    expect(activeWorkoutClock(0, 5, 59, 60)).toBe('00:05:00');
  });

  it('defaults to 5s and rejects unsupported intervals', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.activeWorkoutUpdateSeconds).toBe(5);
    expect(
      parseNotificationPreferences(JSON.stringify({ activeWorkoutUpdateSeconds: 1 }))
        .activeWorkoutUpdateSeconds
    ).toBe(5);
    expect(
      parseNotificationPreferences(JSON.stringify({ activeWorkoutUpdateSeconds: 30 }))
        .activeWorkoutUpdateSeconds
    ).toBe(30);
  });
});
