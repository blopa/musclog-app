import {
  Activity,
  Dumbbell,
  Flame,
  Heart,
  SunMedium,
  Target,
  Trophy,
  User,
  Zap,
} from 'lucide-react-native';

import { AvatarColor } from '../types/AvatarColor';
import { AvatarIcon } from '../types/AvatarIcon';
import { getAvatarBackgroundColor, getAvatarColor } from './avatarColorUtils';

export function getAvatarIcon(avatarIcon?: AvatarIcon | null) {
  if (!avatarIcon) {
    return User;
  }

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
    // TODO: add proper lucide icons here
    restaurant: User,
    'ramen-dining': User,
    'dinner-dining': User,
    'bakery-dining': User,
    'local-cafe': User,
    nutrition: User,
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
