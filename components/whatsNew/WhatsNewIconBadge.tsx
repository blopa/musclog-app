import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

const SIZES = {
  hero: { circle: 112, icon: '5xl' },
  page: { circle: 72, icon: '3xl' },
} as const;

/** An icon in a soft accent circle: the tour's way of giving a heading something to anchor to. */
export function WhatsNewIconBadge({
  icon: Icon,
  size,
}: {
  icon: LucideIcon;
  size: keyof typeof SIZES;
}) {
  const theme = useTheme();
  const { circle, icon } = SIZES[size];
  return (
    <View
      className="items-center justify-center rounded-full bg-accent-primary/10"
      style={{ width: circle, height: circle }}
    >
      <Icon size={theme.iconSize[icon]} color={theme.colors.accent.primary} />
    </View>
  );
}
