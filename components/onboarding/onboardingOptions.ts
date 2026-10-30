import {
  Dumbbell,
  Equal,
  Flame,
  Heart,
  type LucideIcon,
  Scale,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react-native';

import type { FitnessGoal, WeightGoal } from '@/database/models/User';

export type FitnessOption = {
  value: FitnessGoal;
  labelKey: string;
  icon: LucideIcon;
};

export type WeightOption = {
  value: WeightGoal;
  labelKey: string;
  icon: LucideIcon;
};

/**
 * The goal choices the quick and personalized goal screens offer. They live here, not in each
 * route file, so the two screens cannot disagree about which fitness goals exist: `weight_loss`
 * is a valid profile goal that one list had silently left out.
 */
export const FITNESS_OPTIONS: FitnessOption[] = [
  { value: 'hypertrophy', labelKey: 'onboarding.quickGoals.buildMuscle', icon: Dumbbell },
  { value: 'strength', labelKey: 'onboarding.quickGoals.strength', icon: Zap },
  { value: 'endurance', labelKey: 'onboarding.quickGoals.endurance', icon: Flame },
  { value: 'weight_loss', labelKey: 'onboarding.quickGoals.weightLoss', icon: Scale },
  { value: 'general', labelKey: 'onboarding.quickGoals.general', icon: Heart },
];

export const WEIGHT_OPTIONS: WeightOption[] = [
  { value: 'lose', labelKey: 'onboarding.quickGoals.lose', icon: TrendingDown },
  { value: 'maintain', labelKey: 'onboarding.quickGoals.maintain', icon: Equal },
  { value: 'gain', labelKey: 'onboarding.quickGoals.gain', icon: TrendingUp },
];
