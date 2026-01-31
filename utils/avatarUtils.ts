import { AvatarIcon } from '../types/AvatarIcon';
import { AvatarColor } from '../types/AvatarColor';
import {
  User,
  Dumbbell,
  Zap,
  Activity,
  Trophy,
  Target,
  Heart,
  Flame,
  SunMedium,
} from 'lucide-react-native';
import { getAvatarColor, getAvatarBackgroundColor } from './avatarColorUtils';

export function getAvatarIcon(avatarIcon?: AvatarIcon | null) {
  if (!avatarIcon) return User;

  const iconMap = {
    person: User,
    fitness_center: Dumbbell,
    bolt: Zap,
    monitoring: Activity,
    directions_run: Target,
    sports: Dumbbell,
    emoji_events: Trophy,
    heart: Heart,
    flame: Flame,
    meditation: SunMedium,
  };

  return iconMap[avatarIcon] || User;
}

export function getAvatarDisplayProps(
  avatarIcon?: AvatarIcon | null,
  avatarColor?: AvatarColor | null
) {
  const IconComponent = getAvatarIcon(avatarIcon);
  const color = getAvatarColor(avatarColor);
  const backgroundColor = getAvatarBackgroundColor(avatarColor);

  return {
    IconComponent,
    color,
    backgroundColor,
  };
}
