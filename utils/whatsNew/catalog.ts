import { WEEKLY_REVIEW_ROUTE } from '@/constants/weeklyReviewRoute';

export const WHATS_NEW_ICONS = [
  'layout',
  'list',
  'target',
  'trendingUp',
  'timer',
  'dumbbell',
  'calendar',
  'heart',
  'shuffle',
  'shield',
  'flame',
  'settings',
] as const;
export type WhatsNewIconName = (typeof WHATS_NEW_ICONS)[number];

/** Facts about the person's data that can gate a whole page of a release. */
export const WHATS_NEW_CONDITIONS = ['cycleTracking'] as const;
export type WhatsNewCondition = (typeof WHATS_NEW_CONDITIONS)[number];
export type WhatsNewContext = Record<WhatsNewCondition, boolean>;
/** Nothing is known: every conditional page stays hidden. */
export const EMPTY_WHATS_NEW_CONTEXT: WhatsNewContext = { cycleTracking: false };

export const WHATS_NEW_SETTINGS = [
  'workoutView',
  'workoutAutonomy',
  'progressionMode',
  'autoStartRestTimer',
  'restTimerHaptics',
  'reviewWeekday',
] as const;
export type WhatsNewSetting = (typeof WHATS_NEW_SETTINGS)[number];

type SettingSpec = { kind: 'enum'; values: readonly string[] } | { kind: 'boolean' | 'weekday' };
export const WHATS_NEW_SETTING_CATALOG = {
  workoutView: { kind: 'enum', values: ['guided', 'inline'] },
  workoutAutonomy: { kind: 'enum', values: ['suggest', 'manual'] },
  progressionMode: { kind: 'enum', values: ['reps_first', 'weight_first'] },
  autoStartRestTimer: { kind: 'boolean' },
  restTimerHaptics: { kind: 'boolean' },
  reviewWeekday: { kind: 'weekday' },
} as const satisfies Record<WhatsNewSetting, SettingSpec>;

export type WhatsNewSettingValues = {
  [K in WhatsNewSetting]: (typeof WHATS_NEW_SETTING_CATALOG)[K] extends {
    values: readonly (infer V)[];
  }
    ? V
    : (typeof WHATS_NEW_SETTING_CATALOG)[K]['kind'] extends 'boolean'
      ? boolean
      : number;
};
export type WhatsNewSettingValue = WhatsNewSettingValues[WhatsNewSetting];

export function isWhatsNewSettingValue<K extends WhatsNewSetting>(
  setting: K,
  value: unknown
): value is WhatsNewSettingValues[K] {
  const spec = WHATS_NEW_SETTING_CATALOG[setting];
  switch (spec.kind) {
    case 'enum':
      return typeof value === 'string' && (spec.values as readonly string[]).includes(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'weekday':
      return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
  }
}

export const WHATS_NEW_ACTIONS = [
  'openWorkoutSettings',
  'openCardioLog',
  'openWeeklyReview',
  'openWorkouts',
] as const;
export type WhatsNewAction = (typeof WHATS_NEW_ACTIONS)[number];
export const WHATS_NEW_ACTION_CATALOG = {
  openWorkoutSettings: { kind: 'modal' },
  openCardioLog: { kind: 'modal' },
  openWeeklyReview: { kind: 'route', route: WEEKLY_REVIEW_ROUTE },
  openWorkouts: { kind: 'route', route: '/app/workout/workouts' },
} as const satisfies Record<WhatsNewAction, { kind: 'modal' } | { kind: 'route'; route: string }>;
export type WhatsNewRoute = Extract<
  (typeof WHATS_NEW_ACTION_CATALOG)[WhatsNewAction],
  { kind: 'route' }
>['route'];
export type WhatsNewModalAction = {
  [K in WhatsNewAction]: (typeof WHATS_NEW_ACTION_CATALOG)[K]['kind'] extends 'modal' ? K : never;
}[WhatsNewAction];
