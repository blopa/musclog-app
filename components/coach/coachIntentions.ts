import {
  ClipboardList,
  type LucideIcon,
  PlusCircle,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react-native';

import {
  ANALYZE_PROGRESS,
  type ChatIntention,
  GENERATE_MEAL_PLAN,
  GENERATE_MY_WORKOUTS,
  NUTRITION_CHECK,
  TRACK_MEAL,
} from '@/constants/chat';
import type { Theme } from '@/theme';

export type CoachIntentionConfig = {
  /** Prefix of the parked coach message's id. */
  idPrefix: string;
  /** Translation key for the parked coach prompt. */
  promptKey: string;
  icon: LucideIcon;
  /** Takes the theme rather than a resolved colour so chips follow the active theme. */
  iconColor: (theme: Theme) => string;
  /** Chip label above the composer. */
  labelKey: string;
  /**
   * Label in the "armed" banner. Usually the same copy as `labelKey`, but the banner has room for
   * a longer phrasing where the chip does not — keep both explicit so the compiler asks for them.
   */
  bannerLabelKey: string;
};

/**
 * Everything that differs between armable coach intentions. Arming is otherwise identical for all
 * of them (persist the key, set pending state, park a prompt) and every one of them is reachable
 * from the same quick-action chip row, so behaviour and presentation live in one entry rather than
 * several parallel tables. Registering a new intention here — plus its `CHAT_INTENTIONS` entry —
 * is the only edit needed; the chip row and the armed banner both read this map.
 *
 * `Record<ChatIntention, …>` is load-bearing: widening `CHAT_INTENTIONS` fails the build until the
 * new intention is configured, so callers can index this without a fallback branch.
 */
export const COACH_INTENTIONS: Record<ChatIntention, CoachIntentionConfig> = {
  [GENERATE_MY_WORKOUTS]: {
    idPrefix: 'pending-workout-gen',
    promptKey: 'coach.workoutGenerationPrompt',
    icon: PlusCircle,
    iconColor: (theme) => theme.colors.accent.primary,
    labelKey: 'coach.actions.createWorkout',
    bannerLabelKey: 'coach.actions.workoutGen',
  },
  [GENERATE_MEAL_PLAN]: {
    idPrefix: 'pending-meal-plan-gen',
    promptKey: 'coach.mealPlanPrompt',
    icon: ClipboardList,
    iconColor: (theme) => theme.colors.status.success,
    labelKey: 'coach.actions.mealPlan',
    bannerLabelKey: 'coach.actions.mealPlan',
  },
  [ANALYZE_PROGRESS]: {
    idPrefix: 'pending-analyze-progress',
    promptKey: 'coach.analyzeProgressPrompt',
    icon: TrendingUp,
    iconColor: (theme) => theme.colors.status.info,
    labelKey: 'coach.actions.analyzeProgress',
    bannerLabelKey: 'coach.actions.analyzeProgress',
  },
  [TRACK_MEAL]: {
    idPrefix: 'pending-track-meal',
    promptKey: 'coach.trackMealPrompt',
    icon: UtensilsCrossed,
    iconColor: (theme) => theme.colors.accent.primary,
    labelKey: 'coach.actions.trackMeal',
    bannerLabelKey: 'coach.actions.trackMeal',
  },
  [NUTRITION_CHECK]: {
    idPrefix: 'pending-nutrition-check',
    promptKey: 'coach.nutritionCheckPrompt',
    icon: UtensilsCrossed,
    iconColor: (theme) => theme.colors.status.warning,
    labelKey: 'coach.actions.nutritionCheck',
    bannerLabelKey: 'coach.actions.nutritionCheck',
  },
};
