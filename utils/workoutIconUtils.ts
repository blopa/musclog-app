import type { LucideIcon } from 'lucide-react-native';
import { Activity, Dumbbell, Flame, Heart, Target, Trophy, Zap } from 'lucide-react-native';

const WORKOUT_ICON_MAP: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  target: Target,
  zap: Zap,
  trophy: Trophy,
  activity: Activity,
  heart: Heart,
  flame: Flame,
};

export type WorkoutIconName = keyof typeof WORKOUT_ICON_MAP;

export function getWorkoutIcon(icon?: string | null): LucideIcon {
  if (!icon) {
    return Dumbbell;
  }

  return WORKOUT_ICON_MAP[icon] ?? Dumbbell;
}

export const WORKOUT_ICON_OPTIONS: { value: WorkoutIconName; label: string }[] = [
  { value: 'dumbbell', label: 'ai.icons.Dumbbell' },
  { value: 'target', label: 'ai.icons.Target' },
  { value: 'zap', label: 'ai.icons.Zap' },
  { value: 'trophy', label: 'ai.icons.Trophy' },
  { value: 'activity', label: 'ai.icons.Activity' },
  { value: 'heart', label: 'ai.icons.Heart' },
  { value: 'flame', label: 'ai.icons.Flame' },
];
