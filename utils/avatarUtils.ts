import {
  Activity,
  Apple,
  Coffee,
  Croissant,
  Droplet,
  Dumbbell,
  Egg,
  Flame,
  ForkKnifeIcon,
  Heart,
  Lightbulb,
  Popcorn,
  Scale,
  Soup,
  SunMedium,
  Target,
  Trophy,
  User,
  UtensilsCrossed,
  Wind,
  Zap,
} from 'lucide-react-native';

import { Theme, theme as defaultTheme } from '../theme';
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
    droplet: Droplet,
    scale: Scale,
    egg: Egg,
    cup: Popcorn,
    lightbulb: Lightbulb,
    wind: Wind,
  };

  return iconMap[avatarIcon] || User;
}

export function getAvatarDisplayProps(
  avatarIcon?: AvatarIcon | null,
  avatarColor?: AvatarColor | null,
  theme: Theme = defaultTheme
) {
  const IconComponent = getAvatarIcon(avatarIcon);
  const color = getAvatarColor(avatarColor, theme);
  const backgroundColor = getAvatarBackgroundColor(avatarColor, theme);

  return {
    IconComponent,
    color,
    backgroundColor,
  };
}
