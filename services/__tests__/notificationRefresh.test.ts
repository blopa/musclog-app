import { refreshAllNotifications } from '@/services/notificationRefresh';

const mockRun = jest.fn(async () => undefined);

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@/services/NotificationService', () => ({
  NotificationService: {
    scheduleWorkoutReminders: () => mockRun(),
    scheduleGoalAtRiskReminder: () => mockRun(),
  },
}));
jest.mock('@/services/NutritionNotificationService', () => ({
  NutritionNotificationService: {
    scheduleNutritionOverview: () => mockRun(),
    scheduleCheckinNotifications: () => mockRun(),
  },
}));
jest.mock('@/services/CycleNotificationService', () => ({
  CycleNotificationService: { scheduleMenstrualCycleNotifications: () => mockRun() },
}));

describe('refreshAllNotifications', () => {
  beforeEach(() => mockRun.mockClear());

  it('re-plans every reminder family', async () => {
    await refreshAllNotifications();
    expect(mockRun).toHaveBeenCalledTimes(5);
  });
});
