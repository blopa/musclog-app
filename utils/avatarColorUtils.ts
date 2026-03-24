import { theme } from '../theme'; // TODO: figure out a way to use useTheme instead or dynamically use dark or light theme based on configuration
import { AvatarColor } from '../types/AvatarColor';

export function getAvatarColor(avatarColor?: AvatarColor | null) {
  if (!avatarColor) {
    return theme.colors.accent.primary;
  }

  const colorMap = {
    emerald: theme.colors.avatar.emerald,
    blue: theme.colors.avatar.blue,
    purple: theme.colors.avatar.purple,
    pink: theme.colors.avatar.pink,
    orange: theme.colors.avatar.orange,
    teal: theme.colors.avatar.teal,
    yellow: theme.colors.avatar.yellow,
    indigo: theme.colors.avatar.indigo,
  };

  return colorMap[avatarColor] || theme.colors.accent.primary;
}

export function getAvatarBackgroundColor(avatarColor?: AvatarColor | null) {
  if (!avatarColor) {
    return theme.colors.accent.primary20;
  }

  const bgColorMap = {
    emerald: theme.colors.avatarBg.emerald,
    blue: theme.colors.avatarBg.blue,
    purple: theme.colors.avatarBg.purple,
    pink: theme.colors.avatarBg.pink,
    orange: theme.colors.avatarBg.orange,
    teal: theme.colors.avatarBg.teal,
    yellow: theme.colors.avatarBg.yellow,
    indigo: theme.colors.avatarBg.indigo,
  };

  return bgColorMap[avatarColor] || theme.colors.accent.primary20;
}
