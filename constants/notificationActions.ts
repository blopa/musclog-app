/** Android channel ids. Separate channels let the OS settings silence one kind without touching another. */
export const NOTIFICATION_CHANNELS = {
  default: 'default',
  cycle: 'cycle',
  activeWorkout: 'workout-active',
  restTimer: 'rest-timer',
  workoutReminders: 'workout-reminders',
} as const;

/** Notification categories carry the action buttons shown under a notification. */
export const NOTIFICATION_CATEGORIES = {
  restTimer: 'rest-timer',
  workoutReminder: 'workout-reminder',
} as const;

export const NOTIFICATION_ACTIONS = {
  restAddTime: 'rest-add-time',
  restNextSet: 'rest-next-set',
  reminderSnooze: 'reminder-snooze',
} as const;

export const REST_TIMER_NOTIFICATION_ID = 'rest-timer-notification';
export const REST_TIMER_REPEAT_NOTIFICATION_ID = 'rest-timer-repeat-notification';
export const UNFINISHED_WORKOUT_NOTIFICATION_ID = 'unfinished-workout-notification';
export const GOAL_AT_RISK_NOTIFICATION_TYPE = 'goal-at-risk';
