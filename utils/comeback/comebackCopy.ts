import type { SetupStepKey } from '@/utils/comeback/comebackSetupSteps';
import type {
  BreakLength,
  ComebackEating,
  ComebackEnergy,
  ComebackFeel,
  ComebackNutritionGoal,
  ComebackStartChoice,
  ComebackTrack,
  ComebackTrackingDepth,
} from '@/utils/comeback/comebackState';
import type { TrainingLocation } from '@/utils/onboardingTraining';

/**
 * Whole translation keys for every enumerated answer. They are held in tables rather than built as
 * `t(`comeback.x.${value}`)` because `scripts/check-translations.js` cannot see a key assembled at the
 * call site, and a `Record` makes a new answer a build error until it has its copy.
 */

export type ComebackKey = `comeback.${string}`;

export const TRACK_LABEL_KEYS: Record<ComebackTrack, ComebackKey> = {
  workout: 'comeback.setup.track.workout',
  nutrition: 'comeback.setup.track.nutrition',
  both: 'comeback.setup.track.both',
};

export const BREAK_LENGTH_LABEL_KEYS: Record<BreakLength, ComebackKey> = {
  under1m: 'comeback.setup.breakLength.under1m',
  '1to3m': 'comeback.setup.breakLength.1to3m',
  '3to6m': 'comeback.setup.breakLength.3to6m',
  over6m: 'comeback.setup.breakLength.over6m',
};

export const START_CHOICE_LABEL_KEYS: Record<ComebackStartChoice, ComebackKey> = {
  ownPlan: 'comeback.setup.start.ownPlan',
  shortPlan: 'comeback.setup.start.shortPlan',
  chooseLater: 'comeback.setup.start.chooseLater',
};

export const EATING_LABEL_KEYS: Record<ComebackEating, ComebackKey> = {
  cook: 'comeback.setup.eating.cook',
  mix: 'comeback.setup.eating.mix',
  out: 'comeback.setup.eating.out',
  varies: 'comeback.setup.eating.varies',
};

export const TRACKING_LABEL_KEYS: Record<ComebackTrackingDepth, ComebackKey> = {
  full: 'comeback.setup.tracking.full',
  caloriesProtein: 'comeback.setup.tracking.caloriesProtein',
  mealsOnly: 'comeback.setup.tracking.mealsOnly',
};

export const NUTRITION_GOAL_LABEL_KEYS: Record<ComebackNutritionGoal, ComebackKey> = {
  regular: 'comeback.setup.goal.regular',
  loseSlowly: 'comeback.setup.goal.loseSlowly',
  rebuild: 'comeback.setup.goal.rebuild',
  keep: 'comeback.setup.goal.keep',
};

export const ENERGY_LABEL_KEYS: Record<ComebackEnergy, ComebackKey> = {
  plenty: 'comeback.setup.energy.plenty',
  some: 'comeback.setup.energy.some',
  low: 'comeback.setup.energy.low',
};

export const FEEL_LABEL_KEYS: Record<ComebackFeel, ComebackKey> = {
  easy: 'comeback.checkpoint.feel.easy',
  right: 'comeback.checkpoint.feel.right',
  hard: 'comeback.checkpoint.feel.hard',
};

export const STEP_COPY: Record<SetupStepKey, { titleKey: ComebackKey; subtitleKey: ComebackKey }> =
  {
    intro: { titleKey: 'comeback.setup.intro.title', subtitleKey: 'comeback.setup.intro.subtitle' },
    track: { titleKey: 'comeback.setup.track.title', subtitleKey: 'comeback.setup.track.subtitle' },
    where: { titleKey: 'comeback.setup.where.title', subtitleKey: 'comeback.setup.where.subtitle' },
    days: { titleKey: 'comeback.setup.days.title', subtitleKey: 'comeback.setup.days.subtitle' },
    start: { titleKey: 'comeback.setup.start.title', subtitleKey: 'comeback.setup.start.subtitle' },
    eating: {
      titleKey: 'comeback.setup.eating.title',
      subtitleKey: 'comeback.setup.eating.subtitle',
    },
    tracking: {
      titleKey: 'comeback.setup.tracking.title',
      subtitleKey: 'comeback.setup.tracking.subtitle',
    },
    goal: { titleKey: 'comeback.setup.goal.title', subtitleKey: 'comeback.setup.goal.subtitle' },
    energy: {
      titleKey: 'comeback.setup.energy.title',
      subtitleKey: 'comeback.setup.energy.subtitle',
    },
    plan: { titleKey: 'comeback.setup.plan.title', subtitleKey: 'comeback.setup.plan.subtitle' },
  };

export const WHERE_LABEL_KEYS: Record<TrainingLocation, ComebackKey> = {
  gym: 'comeback.setup.where.gym',
  home: 'comeback.setup.where.home',
  minimal: 'comeback.setup.where.minimal',
};

/** Days-a-week choices: the label and the line that says why fewer is the better start. */
export const DAYS_CHOICES = [
  { value: 1, labelKey: 'comeback.setup.days.one' },
  { value: 2, labelKey: 'comeback.setup.days.two', recommended: true },
  { value: 3, labelKey: 'comeback.setup.days.three' },
  { value: 4, labelKey: 'comeback.setup.days.four' },
] as const satisfies readonly { value: number; labelKey: ComebackKey; recommended?: boolean }[];
