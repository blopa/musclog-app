import { AvatarColor } from '../types/AvatarColor';
import { theme } from '../theme';

export function getAvatarColor(avatarColor?: AvatarColor | null) {
  if (!avatarColor) return theme.colors.accent.primary;

  const colorMap = {
    emerald: theme.colors.accent.primary,
    blue: '#3B82F6',
    purple: '#8B5CF6',
    pink: '#EC4899',
    orange: '#F97316',
    teal: '#14B8A6',
    yellow: '#EAB308',
    indigo: '#6366F1',
  };

  return colorMap[avatarColor] || theme.colors.accent.primary;
}

export function getAvatarBackgroundColor(avatarColor?: AvatarColor | null) {
  if (!avatarColor) return theme.colors.accent.primary20;

  const bgColorMap = {
    emerald: theme.colors.accent.primary20,
    blue: '#3B82F620',
    purple: '#8B5CF620',
    pink: '#EC489920',
    orange: '#F9731620',
    teal: '#14B8A620',
    yellow: '#EAB30820',
    indigo: '#6366F120',
  };

  return bgColorMap[avatarColor] || theme.colors.accent.primary20;
}
