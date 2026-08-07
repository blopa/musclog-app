// Manual mock for `expo-notifications` — a native module, so its real implementation
// cannot load in Jest. Covers the surface `services/notifications` uses.

module.exports = {
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2, MAX: 5, MIN: 1, NONE: 0 },
  AndroidNotificationVisibility: { PRIVATE: 0, PUBLIC: 1, SECRET: 2, UNKNOWN: 3 },
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false, status: 'undetermined' }),
  PermissionStatus: { DENIED: 'denied', GRANTED: 'granted', UNDETERMINED: 'undetermined' },
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: false, status: 'undetermined' }),
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DAILY: 'daily',
    DATE: 'date',
    MONTHLY: 'monthly',
    TIME_INTERVAL: 'timeInterval',
    WEEKLY: 'weekly',
    YEARLY: 'yearly',
  },
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  setNotificationHandler: jest.fn(),
};
