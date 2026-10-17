/** Android channel ids. Separate channels let the OS settings silence one kind without touching another. */
export const NOTIFICATION_CHANNELS = {
  default: 'default',
  cycle: 'cycle',
  activeWorkout: 'workout-active',
  restTimer: 'rest-timer',
  /** The rest alert without its chime (vibration only), and the "get ready" heads-up. */
  restTimerQuiet: 'rest-timer-quiet',
  workoutReminders: 'workout-reminders',
} as const;

/** Notification categories carry the action buttons shown under a notification. */
export const NOTIFICATION_CATEGORIES = {
  restTimer: 'rest-timer',
  workoutReminder: 'workout-reminder',
  /** Any cycle reminder: one Snooze button. */
  cycleReminder: 'cycle-reminder',
  /** The pill reminder: Done / Later / Skip, worded so nothing on screen says what it is for. */
  cyclePill: 'cycle-pill',
} as const;

export const NOTIFICATION_ACTIONS = {
  restAddTime: 'rest-add-time',
  restNextSet: 'rest-next-set',
  reminderSnooze: 'reminder-snooze',
  cycleSnooze: 'cycle-snooze',
  pillDone: 'pill-done',
  pillLater: 'pill-later',
  pillSkip: 'pill-skip',
} as const;

/** `data.type` of every cycle reminder, and of a snoozed copy (which a reschedule must not erase). */
export const CYCLE_NOTIFICATION_TYPE = 'menstrual-cycle';
export const CYCLE_SNOOZE_NOTIFICATION_TYPE = 'menstrual-cycle-snooze';

export const REST_TIMER_NOTIFICATION_ID = 'rest-timer-notification';
export const REST_TIMER_HEADS_UP_NOTIFICATION_ID = 'rest-timer-heads-up-notification';
export const WORK_TIMER_NOTIFICATION_ID = 'work-timer-notification';
export const REST_TIMER_REPEAT_NOTIFICATION_ID = 'rest-timer-repeat-notification';
export const UNFINISHED_WORKOUT_NOTIFICATION_ID = 'unfinished-workout-notification';
export const GOAL_AT_RISK_NOTIFICATION_TYPE = 'goal-at-risk';
