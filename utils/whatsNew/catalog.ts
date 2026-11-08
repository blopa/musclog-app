import type { LoggyPoseName } from '@/components/LoggyPose';
import { WEEKLY_REVIEW_ROUTE } from '@/constants/weeklyReviewRoute';
import { YEAR_IN_REVIEW_ROUTE } from '@/constants/yearInReviewRoute';
import { aiSetupRoute } from '@/utils/onboardingRoutes';

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
  'bot',
  'smile',
  'fileUp',
  'undo',
  'share',
  'scale',
  'activity',
] as const;
export type WhatsNewIconName = (typeof WHATS_NEW_ICONS)[number];

/**
 * Loggy poses an info block may show in place of its icon (a subset of `LoggyPoseName`). Each is
 * the joke or the job of the page that names it: `running` introduces him, `writing` is the
 * import, `trophy` the year story, `flex` strength levels and `magnify` the training-load map.
 */
export const WHATS_NEW_POSES = [
  'running',
  'writing',
  'trophy',
  'flex',
  'magnify',
] as const satisfies readonly LoggyPoseName[];
export type WhatsNewPoseName = (typeof WHATS_NEW_POSES)[number];

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
  'showLoggy',
  'animatedLoggy',
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
  showLoggy: { kind: 'boolean' },
  animatedLoggy: { kind: 'boolean' },
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
  'openProfileAiSetup',
  'openWorkoutImport',
  'openYearInReview',
  'openProgress',
] as const;
export type WhatsNewAction = (typeof WHATS_NEW_ACTIONS)[number];
export const WHATS_NEW_ACTION_CATALOG = {
  openWorkoutSettings: { kind: 'modal' },
  openCardioLog: { kind: 'modal' },
  openWeeklyReview: { kind: 'route', route: WEEKLY_REVIEW_ROUTE },
  openWorkouts: { kind: 'route', route: '/app/workout/workouts' },
  openProfileAiSetup: { kind: 'route', route: aiSetupRoute('setup', 'profile') },
  openWorkoutImport: { kind: 'modal' },
  openYearInReview: { kind: 'route', route: YEAR_IN_REVIEW_ROUTE },
  openProgress: { kind: 'route', route: '/app/progress' },
} as const satisfies Record<WhatsNewAction, { kind: 'modal' } | { kind: 'route'; route: string }>;
export type WhatsNewRoute = Extract<
  (typeof WHATS_NEW_ACTION_CATALOG)[WhatsNewAction],
  { kind: 'route' }
>['route'];
export type WhatsNewModalAction = {
  [K in WhatsNewAction]: (typeof WHATS_NEW_ACTION_CATALOG)[K]['kind'] extends 'modal' ? K : never;
}[WhatsNewAction];
