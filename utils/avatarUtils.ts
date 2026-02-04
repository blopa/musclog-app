import {
  Activity,
  Apple,
  Coffee,
  Croissant,
  Dumbbell,
  Flame,
  ForkKnifeIcon,
  Heart,
  Soup,
  SunMedium,
  Target,
  Trophy,
  User,
  UtensilsCrossed,
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
    restaurant: UtensilsCrossed,
    'ramen-dining': Soup,
    'dinner-dining': ForkKnifeIcon,
    'bakery-dining': Croissant,
    'local-cafe': Coffee,
    nutrition: Apple,
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
