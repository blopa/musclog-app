import * as Notifications from 'expo-notifications';

import { database } from '@/database';
import { CycleRepository } from '@/database/repositories/CycleRepository';
import { WorkoutPlanRepository } from '@/database/repositories/WorkoutPlanRepository';
import { SettingsService } from '@/database/services/SettingsService';
import { CycleNotificationService } from '@/services/CycleNotificationService';
import { NotificationService } from '@/services/NotificationService';
import { NutritionNotificationService } from '@/services/NutritionNotificationService';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/utils/notificationPolicy';
import { resolveWorkoutSchedules } from '@/utils/workoutScheduleOwnership';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn(),
    eq: jest.fn((value) => value),
    oneOf: jest.fn((values) => values),
    or: jest.fn(),
    between: jest.fn(),
    gte: jest.fn(),
  },
}));

jest.mock('@/database/models/MenstrualCycle', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/NutritionCheckin', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/WorkoutTemplate', () => ({ __esModule: true, default: class {} }));

// The three-table read and the ownership rule now live in the repository — this suite covers what
// NotificationService does with the ANSWER. Mocked rather than imported for real because the
// repository reaches `database-instance`, which builds the real schema; `@nozbe/watermelondb` is
// stubbed down to `Q` here, so that module graph cannot load.
jest.mock('@/database/repositories/WorkoutPlanRepository', () => ({
  WorkoutPlanRepository: { getResolvedSchedules: jest.fn() },
}));

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly', DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((choices) => choices.ios ?? choices.default),
  },
}));

jest.mock('@/database/services/NutritionGoalService', () => ({
  NutritionGoalService: { getCurrent: jest.fn().mockResolvedValue(null) },
}));

jest.mock('@/database', () => ({
  database: { get: jest.fn() },
}));

jest.mock('@/database/models/WorkoutLog', () => ({ __esModule: true, default: class {} }));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getNotifications: jest.fn(),
    getNotificationsWorkoutReminders: jest.fn(),
    getNotificationsMenstrualCycle: jest.fn(),
    getCycleShowPredictions: jest.fn(),
    getCycleShowFertility: jest.fn(),
    getCycleNotificationStyle: jest.fn(),
    getNotificationPreferences: jest.fn(),
  },
}));

// The cycle reads go through CycleRepository (which reaches the real database instance); the
// decrypting readers are replaced with identity functions so a test can hand over plain DTOs.
jest.mock('@/database/repositories/CycleRepository', () => ({
  CycleRepository: { cycles: jest.fn(), periods: jest.fn(), contexts: jest.fn() },
  readPeriods: jest.fn(async (records: unknown[]) => records),
  readContexts: jest.fn(async (records: unknown[]) => records),
  readCycleConfig: jest.fn(async () => ({ fallbackCycleLength: 28, fallbackPeriodDuration: 5 })),
}));

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { t: jest.fn((key: string) => key) },
}));

jest.mock('@/theme', () => ({
  darkTheme: { colors: { status: { error: '#f00' } } },
}));

const mockDatabase = database as jest.Mocked<typeof database>;
const mockGetResolvedSchedules = WorkoutPlanRepository.getResolvedSchedules as jest.Mock;
const mockSettingsService = SettingsService as jest.Mocked<typeof SettingsService>;
const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

function installTables(tables: Record<string, any[]>) {
  mockDatabase.get.mockImplementation(
    (table: string) =>
      ({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(tables[table] ?? []),
        }),
      }) as any
  );
}

/**
 * Resolves the fixtures through the REAL ownership rule, so this suite still exercises plan-vs-
 * standalone precedence end to end rather than asserting against a hand-written answer that could
 * drift from what `resolveWorkoutSchedules` actually returns.
 */
function installResolvedSchedules(
  plans: any[],
  memberships: any[],
  standaloneSchedules: any[]
): void {
  mockGetResolvedSchedules.mockResolvedValue(
    resolveWorkoutSchedules(plans, memberships, standaloneSchedules)
  );
}

describe('NotificationService.scheduleWorkoutReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 14, 10, 0, 0)); // Wednesday
    mockSettingsService.getNotificationPreferences.mockResolvedValue(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
    mockSettingsService.getNotifications.mockResolvedValue(true);
    mockSettingsService.getNotificationsWorkoutReminders.mockResolvedValue(true);
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'old-workout',
        content: { data: { type: 'workout-reminder' } },
      },
      {
        identifier: 'keep-me',
        content: { data: { type: 'nutrition-overview' } },
      },
    ] as any);
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('scheduled');
  });

  it('uses plan ownership, deduplicates plan reminders, and preserves standalone-only reminders', async () => {
    installResolvedSchedules(
      [
        { id: 'p1', cycleType: 'weekly' },
        { id: 'p2', cycleType: 'weekly' },
        { id: 'rotation', cycleType: 'rotating' },
      ],
      [
        { planId: 'p1', templateId: 'planned', weekDays: [0] },
        { planId: 'p2', templateId: 'planned', weekDays: [0] },
        { planId: 'rotation', templateId: 'rotating', position: 0 },
      ],
      [
        { templateId: 'planned', dayOfWeek: 'Friday', reminderTime: '17:30' },
        { templateId: 'rotating', dayOfWeek: 'Thursday', reminderTime: '18:00' },
        { templateId: 'standalone', dayOfWeek: 'Tuesday', reminderTime: '09:15' },
      ]
    );
    installTables({
      workout_templates: [
        { id: 'planned', name: 'Push', isArchived: false },
        { id: 'rotating', name: 'Rotation Day', isArchived: false },
        { id: 'standalone', name: 'Run', isArchived: false },
      ],
    });

    await NotificationService.scheduleWorkoutReminders();

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-workout');
    // One-off reminders over the next 14 days (Wed 14 Oct → Tue 27 Oct): two Mondays for the plan's
    // workout and two Tuesdays for the standalone one, never a repeating weekly trigger.
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(4);
    const calls = mockNotifications.scheduleNotificationAsync.mock.calls.map(
      ([request]) => request
    );
    expect(calls.every((request) => (request.trigger as any).type === 'date')).toBe(true);
    expect(calls.map((request) => (request.trigger as any).date)).toEqual([
      new Date(2026, 9, 19, 8, 0),
      new Date(2026, 9, 20, 9, 15),
      new Date(2026, 9, 26, 8, 0),
      new Date(2026, 9, 27, 9, 15),
    ]);
    expect(calls[0].content.data).toEqual({
      type: 'workout-reminder',
      templateId: 'planned',
      planId: 'p1',
    });
    expect(calls[1].content.data).toEqual({
      type: 'workout-reminder',
      templateId: 'standalone',
      planId: undefined,
    });
    // The calendar stores are read through the repository, not by this service.
    expect(mockGetResolvedSchedules).toHaveBeenCalledTimes(1);
    expect(mockDatabase.get).toHaveBeenCalledWith('workout_templates');
    expect(mockDatabase.get).not.toHaveBeenCalledWith('schedules');
  });
});

describe('weekly review reminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 12, 7));
    Object.assign(mockSettingsService, {
      getNotificationsWeeklyReview: jest.fn(async () => true),
      getReviewWeekday: jest.fn(async () => 1),
      getIntuitiveEatingMode: jest.fn(async () => false),
    });
    mockSettingsService.getNotifications.mockResolvedValue(true);
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    installTables({ weekly_reviews: [] });
  });
  afterEach(() => jest.useRealTimers());
  it('schedules one reminder and skips resubmission for an existing identifier', async () => {
    await NutritionNotificationService.scheduleWeeklyReviewNotification();
    const request = mockNotifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(request.content?.data).toMatchObject({
      type: 'weekly-review',
      reviewDay: expect.any(Number),
    });
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: request.identifier, content: request.content },
    ] as any);
    await NutritionNotificationService.scheduleWeeklyReviewNotification();
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
  it('does not send an immediate duplicate when this morning has passed', async () => {
    jest.setSystemTime(new Date(2026, 9, 12, 12));
    await NutritionNotificationService.scheduleWeeklyReviewNotification();
    const trigger = mockNotifications.scheduleNotificationAsync.mock.calls[0][0].trigger as any;
    expect(trigger.date.getDate()).toBe(19);
    expect(trigger.date.getHours()).toBe(8);
  });
  it('respects opt-out and cancels only weekly reminders', async () => {
    mockSettingsService.getNotificationsWeeklyReview.mockResolvedValue(false);
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'review', content: { data: { type: 'weekly-review' } } },
      { identifier: 'other', content: { data: { type: 'rest-timer' } } },
    ] as any);
    await NutritionNotificationService.scheduleWeeklyReviewNotification();
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('review');
    expect(mockNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('other');
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('cycle reminders', () => {
  const D = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = (daysAgo: number) => today.getTime() - daysAgo * D;
  const period = (id: string, daysAgo: number) => ({
    id,
    cycleId: 'c1',
    startDate: start(daysAgo),
    endDate: start(daysAgo) + 4 * D,
    endKind: 'logged',
    timezone: '+00:00',
    excludedFromStats: false,
    note: '',
  });
  const repo = CycleRepository as jest.Mocked<typeof CycleRepository>;

  function arrange(periods: ReturnType<typeof period>[], style: 'discreet' | 'detailed') {
    mockSettingsService.getNotifications.mockResolvedValue(true);
    (mockSettingsService.getNotificationsMenstrualCycle as jest.Mock).mockResolvedValue(true);
    (mockSettingsService.getCycleShowPredictions as jest.Mock).mockResolvedValue(true);
    (mockSettingsService.getCycleShowFertility as jest.Mock).mockResolvedValue(false);
    (mockSettingsService.getCycleNotificationStyle as jest.Mock).mockResolvedValue(style);
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    mockNotifications.scheduleNotificationAsync.mockClear();
    repo.cycles.mockReturnValue({ fetch: async () => [{ id: 'c1', isActive: true }] } as never);
    repo.periods.mockReturnValue({ fetch: async () => periods } as never);
    repo.contexts.mockReturnValue({ fetch: async () => [] } as never);
  }

  const onTrack = [period('a', 66), period('b', 38), period('c', 10)];

  it('words a reminder discreetly by default, so a lock screen never says what it is about', async () => {
    arrange(onTrack, 'discreet');
    await CycleNotificationService.scheduleMenstrualCycleNotifications();
    const content = mockNotifications.scheduleNotificationAsync.mock.calls[0][0].content;
    expect(content.title).toBe('notifications.types.cycleDiscreet.title');
    expect(content.body).toBe('notifications.types.cycleDiscreet.body');
    expect(content.data).toMatchObject({ type: 'menstrual-cycle', subtype: 'period-start' });
  });

  it('uses the descriptive wording only when the person chose it', async () => {
    arrange(onTrack, 'detailed');
    await CycleNotificationService.scheduleMenstrualCycleNotifications();
    const content = mockNotifications.scheduleNotificationAsync.mock.calls[0][0].content;
    expect(content.title).toBe('cycle.notifications.periodStart.title');
    // A range for an estimate, never one confident date.
    expect(content.body).toBe('cycle.notifications.periodStart.bodyRange');
  });

  it('names the task but never the topic in the subtle style', async () => {
    arrange(onTrack, 'subtle' as never);
    await CycleNotificationService.scheduleMenstrualCycleNotifications();
    const content = mockNotifications.scheduleNotificationAsync.mock.calls[0][0].content;
    expect(content.title).toBe('notifications.types.cycleDiscreet.title');
    expect(content.body).toBe('cycle.notifications.subtle.cycle');
  });

  it('schedules cycle reminders on their own channel', async () => {
    arrange(onTrack, 'discreet');
    await CycleNotificationService.scheduleMenstrualCycleNotifications();
    const { trigger } = mockNotifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(trigger).toMatchObject({ channelId: 'cycle' });
  });

  it('schedules no fertile-window reminder unless fertility estimates are on', async () => {
    arrange(onTrack, 'detailed');
    await CycleNotificationService.scheduleMenstrualCycleNotifications();
    const subtypes = mockNotifications.scheduleNotificationAsync.mock.calls.map(
      (call) => (call[0].content.data as { subtype: string }).subtype
    );
    expect(subtypes).toEqual(['period-start']);
  });

  it('serializes overlapping scheduling requests so cancellation cannot leave duplicate reminders', async () => {
    arrange(onTrack, 'discreet');
    let started!: () => void;
    let release!: (value: []) => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = new Promise<[]>((resolve) => {
      release = resolve;
    });
    mockNotifications.getAllScheduledNotificationsAsync.mockImplementationOnce(() => {
      started();
      return pending;
    });
    mockNotifications.getAllScheduledNotificationsAsync.mockClear();
    const first = CycleNotificationService.scheduleMenstrualCycleNotifications();
    const second = CycleNotificationService.scheduleMenstrualCycleNotifications();
    await began;
    const readsWhileFirstPending =
      mockNotifications.getAllScheduledNotificationsAsync.mock.calls.length;
    release([]);
    await Promise.all([first, second]);
    expect(readsWhileFirstPending).toBe(1);
    expect(mockNotifications.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
  });

  it('schedules nothing for a period that is overdue', async () => {
    arrange([period('a', 120), period('b', 92), period('c', 64)], 'detailed');
    await CycleNotificationService.scheduleMenstrualCycleNotifications();
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
