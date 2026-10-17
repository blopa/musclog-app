import { DEFAULT_REST_SECONDS } from '@/constants/restTimer';
import {
  ACTIVE_GYM_ID_SETTING_TYPE,
  APP_LOCK_MODE_SETTING_TYPE,
  type AppLockMode,
  AUTO_START_REST_TIMER_SETTING_TYPE,
  CYCLE_NOTIFICATION_STYLE_SETTING_TYPE,
  CYCLE_PIN_SUGGESTED_SETTING_TYPE,
  CYCLE_QUICK_LOG_SETTING_TYPE,
  CYCLE_SHOW_FERTILITY_SETTING_TYPE,
  CYCLE_SHOW_PREDICTIONS_SETTING_TYPE,
  CYCLE_VARIABILITY_HINT_SETTING_TYPE,
  type CycleNotificationStyle,
  DEFAULT_REST_SECONDS_SETTING_TYPE,
  NOTIFICATIONS_WEEKLY_REVIEW_SETTING_TYPE,
  parseAppLockMode,
  parseCycleNotificationStyle,
  parseRestAlertSound,
  parseRestHapticStrength,
  parseRestHeadsUpSeconds,
  parseWorkoutAutonomy,
  REST_ALERT_SOUND_SETTING_TYPE,
  REST_HAPTIC_STRENGTH_SETTING_TYPE,
  REST_HEADS_UP_SECONDS_SETTING_TYPE,
  REST_TIMER_HAPTICS_SETTING_TYPE,
  type RestAlertSound,
  type RestHapticStrength,
  type RestHeadsUpSeconds,
  REVIEW_WEEKDAY_SETTING_TYPE,
  SHOW_HOME_STEPS_SETTING_TYPE,
  WEEKLY_REVIEW_WELCOME_SEEN_SETTING_TYPE,
  WORKOUT_AUTONOMY_SETTING_TYPE,
  WORKOUT_VIEW_SETTING_TYPE,
  type WorkoutAutonomy,
} from '@/constants/settings';
import { clampRestSeconds } from '@/utils/restTimer';

/**
 * One setting stored as a string in the `settings` table: where it lives, what it is when nothing
 * is stored, and how it reads and writes. The ONE definition of a setting's default and parsing —
 * `SettingsService.get`/`set` and `SettingsContext` both go through it, where each used to spell
 * the default itself (so the service and the reactive context could disagree about it).
 */
export type SettingDefinition<T> = {
  type: string;
  defaultValue: T;
  /** Reads a stored value; must accept anything, since rows can come from a newer build or backup. */
  parse: (raw: string) => T;
  /** Writes a value. May throw to refuse one that must never be stored. */
  serialize: (value: T) => string;
};

const booleanSetting = (type: string, defaultValue: boolean): SettingDefinition<boolean> => ({
  type,
  defaultValue,
  parse: (raw) => raw === 'true',
  serialize: (value) => String(value),
});

const textSetting = (type: string): SettingDefinition<string> => ({
  type,
  defaultValue: '',
  parse: (raw) => raw,
  serialize: (value) => value,
});

/** A closed set of string values whose parser already maps anything unknown to the default. */
const choiceSetting = <T extends string>(
  type: string,
  parse: (raw: string) => T
): SettingDefinition<T> => ({ type, defaultValue: parse(''), parse, serialize: (value) => value });

const DEFAULT_REVIEW_WEEKDAY = 1;
const isWeekday = (value: number) => Number.isInteger(value) && value >= 0 && value <= 6;

export type WorkoutView = 'inline' | 'guided';

export const SETTINGS = {
  cycleShowPredictions: booleanSetting(CYCLE_SHOW_PREDICTIONS_SETTING_TYPE, true),
  cycleShowFertility: booleanSetting(CYCLE_SHOW_FERTILITY_SETTING_TYPE, false),
  cycleNotificationStyle: choiceSetting<CycleNotificationStyle>(
    CYCLE_NOTIFICATION_STYLE_SETTING_TYPE,
    parseCycleNotificationStyle
  ),
  cycleQuickLog: textSetting(CYCLE_QUICK_LOG_SETTING_TYPE),
  cyclePinSuggested: textSetting(CYCLE_PIN_SUGGESTED_SETTING_TYPE),
  cycleVariabilityHintDismissed: booleanSetting(CYCLE_VARIABILITY_HINT_SETTING_TYPE, false),
  appLockMode: choiceSetting<AppLockMode>(APP_LOCK_MODE_SETTING_TYPE, parseAppLockMode),
  workoutAutonomy: choiceSetting<WorkoutAutonomy>(
    WORKOUT_AUTONOMY_SETTING_TYPE,
    parseWorkoutAutonomy
  ),
  autoStartRestTimer: booleanSetting(AUTO_START_REST_TIMER_SETTING_TYPE, true),
  restTimerHaptics: booleanSetting(REST_TIMER_HAPTICS_SETTING_TYPE, true),
  restAlertSound: choiceSetting<RestAlertSound>(REST_ALERT_SOUND_SETTING_TYPE, parseRestAlertSound),
  restHapticStrength: choiceSetting<RestHapticStrength>(
    REST_HAPTIC_STRENGTH_SETTING_TYPE,
    parseRestHapticStrength
  ),
  restHeadsUpSeconds: {
    type: REST_HEADS_UP_SECONDS_SETTING_TYPE,
    defaultValue: parseRestHeadsUpSeconds(''),
    parse: parseRestHeadsUpSeconds,
    serialize: (seconds) => String(seconds),
  } satisfies SettingDefinition<RestHeadsUpSeconds>,
  defaultRestSeconds: {
    type: DEFAULT_REST_SECONDS_SETTING_TYPE,
    defaultValue: DEFAULT_REST_SECONDS,
    parse: (raw) => clampRestSeconds(Number(raw)),
    serialize: (seconds) => String(clampRestSeconds(seconds)),
  } satisfies SettingDefinition<number>,
  /** `null` when no gym is active; stored as an empty string. */
  activeGymId: {
    type: ACTIVE_GYM_ID_SETTING_TYPE,
    defaultValue: null,
    parse: (raw) => raw || null,
    serialize: (id) => id ?? '',
  } satisfies SettingDefinition<string | null>,
  showHomeSteps: booleanSetting(SHOW_HOME_STEPS_SETTING_TYPE, true),
  workoutView: choiceSetting<WorkoutView>(WORKOUT_VIEW_SETTING_TYPE, (raw) =>
    raw === 'inline' ? 'inline' : 'guided'
  ),
  /** The weekday (0 = Sunday) a Weekly Review falls due. */
  reviewWeekday: {
    type: REVIEW_WEEKDAY_SETTING_TYPE,
    defaultValue: DEFAULT_REVIEW_WEEKDAY,
    parse: (raw) => {
      const value = Number(raw);
      return isWeekday(value) ? value : DEFAULT_REVIEW_WEEKDAY;
    },
    serialize: (value) => {
      if (!isWeekday(value)) {
        throw new Error('Invalid weekday');
      }

      return String(value);
    },
  } satisfies SettingDefinition<number>,
  notificationsWeeklyReview: booleanSetting(NOTIFICATIONS_WEEKLY_REVIEW_SETTING_TYPE, false),
  weeklyReviewWelcomeSeen: booleanSetting(WEEKLY_REVIEW_WELCOME_SEEN_SETTING_TYPE, false),
} as const;

/** Reads a setting out of an already-loaded `type → value` map (the reactive context's view). */
export function readSetting<T>(map: ReadonlyMap<string, string>, setting: SettingDefinition<T>): T {
  const raw = map.get(setting.type);
  return raw === undefined ? setting.defaultValue : setting.parse(raw);
}
