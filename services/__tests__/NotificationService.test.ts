import * as Notifications from 'expo-notifications';

import { database } from '@/database';
import { SettingsService } from '@/database/services/SettingsService';
import { NotificationService } from '@/services/NotificationService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn(),
    eq: jest.fn((value) => value),
    oneOf: jest.fn((values) => values),
    or: jest.fn(),
    between: jest.fn(),
  },
}));

jest.mock('@/database/models/MenstrualCycle', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/NutritionCheckin', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/Schedule', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/WorkoutPlan', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/WorkoutPlanTemplate', () => ({
  __esModule: true,
  default: class {},
}));
jest.mock('@/database/models/WorkoutTemplate', () => ({ __esModule: true, default: class {} }));

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
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

jest.mock('@/database', () => ({
  database: { get: jest.fn() },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getNotifications: jest.fn(),
    getNotificationsWorkoutReminders: jest.fn(),
  },
}));

jest.mock('@/database/repositories/PeriodLogRepository', () => ({
  PeriodLogRepository: {},
}));

jest.mock('@/database/services/MenstrualService', () => ({ MenstrualService: {} }));

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { t: jest.fn((key: string) => key) },
}));

jest.mock('@/theme', () => ({
  darkTheme: { colors: { status: { error: '#f00' } } },
}));

const mockDatabase = database as jest.Mocked<typeof database>;
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

describe('NotificationService.scheduleWorkoutReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    installTables({
      workout_plans: [
        { id: 'p1', cycleType: 'weekly' },
        { id: 'p2', cycleType: 'weekly' },
        { id: 'rotation', cycleType: 'rotating' },
      ],
      workout_plan_templates: [
        { planId: 'p1', templateId: 'planned', weekDays: [0] },
        { planId: 'p2', templateId: 'planned', weekDays: [0] },
        { planId: 'rotation', templateId: 'rotating', position: 0 },
      ],
      schedules: [
        { templateId: 'planned', dayOfWeek: 'Friday', reminderTime: '17:30' },
        { templateId: 'rotating', dayOfWeek: 'Thursday', reminderTime: '18:00' },
        { templateId: 'standalone', dayOfWeek: 'Tuesday', reminderTime: '09:15' },
      ],
      workout_templates: [
        { id: 'planned', name: 'Push', isArchived: false },
        { id: 'rotating', name: 'Rotation Day', isArchived: false },
        { id: 'standalone', name: 'Run', isArchived: false },
      ],
    });

    await NotificationService.scheduleWorkoutReminders();

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-workout');
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: { type: 'workout-reminder', templateId: 'planned', planId: 'p1' },
        }),
        trigger: expect.objectContaining({ weekday: 2, hour: 8, minute: 0 }),
      })
    );
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: {
            type: 'workout-reminder',
            templateId: 'standalone',
            planId: undefined,
          },
        }),
        trigger: expect.objectContaining({ weekday: 3, hour: 9, minute: 15 }),
      })
    );
    expect(mockDatabase.get).toHaveBeenCalledWith('schedules');
  });
});
