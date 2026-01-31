import { AvatarIcon } from '../types/AvatarIcon';
import { User, Dumbbell, Zap, Activity, Trophy, Target } from 'lucide-react-native';

export function getAvatarIcon(avatarIcon?: AvatarIcon | null) {
  if (!avatarIcon) return User;

  const iconMap = {
    person: User,
    fitness_center: Dumbbell,
    bolt: Zap,
    monitoring: Activity,
    directions_run: Target,
    emoji_events: Trophy,
  };

  return iconMap[avatarIcon] || User;
}
