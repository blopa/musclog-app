import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type SectionLabelProps = {
  children: string;
  /** `accent` is for the one live-state label on a screen ("Workout in progress", "Today"). */
  tone?: 'default' | 'accent';
  icon?: LucideIcon;
  className?: string;
};

/**
 * The one small label above a group of content. Sentence case, no letter-spacing: tracked
 * all-caps is reserved for unit and weekday abbreviations (see DESIGN.md, Typography).
 */
export function SectionLabel({
  children,
  tone = 'default',
  icon: Icon,
  className,
}: SectionLabelProps) {
  const theme = useTheme();
  const color = tone === 'accent' ? theme.colors.accent.primary : theme.colors.text.secondary;

  return (
    <View className={`flex-row items-center gap-1.5 ${className ?? ''}`}>
      {Icon ? <Icon size={theme.iconSize.sm} color={color} /> : null}
      <Text accessibilityRole="header" className="text-sm font-semibold" style={{ color }}>
        {children}
      </Text>
    </View>
  );
}
