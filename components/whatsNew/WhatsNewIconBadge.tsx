import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

const CIRCLE_SIZE = 72;

/** An icon in a soft accent circle: the tour's way of giving a heading something to anchor to. */
export function WhatsNewIconBadge({ icon: Icon }: { icon: LucideIcon }) {
  const theme = useTheme();
  return (
    <View
      className="items-center justify-center rounded-full bg-accent-primary/10"
      style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
    >
      <Icon size={theme.iconSize['3xl']} color={theme.colors.accent.primary} />
    </View>
  );
}
