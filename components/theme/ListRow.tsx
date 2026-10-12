import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * - `card`: a bordered card row, for a list of records (past reviews).
 * - `filled`: the overlay surface, for an action inside a card or sheet (the "Why?" actions,
 *   today's workouts, the rule summary).
 */
export type ListRowVariant = 'card' | 'filled';

type ListRowProps = {
  title: string;
  onPress?: () => void;
  /** One line under the title. */
  subtitle?: string;
  /** Small uppercase label above the title. */
  overline?: string;
  icon?: LucideIcon;
  iconColor?: string;
  /** Replaces the default chevron (a play icon, a value). `null` shows nothing. */
  trailing?: ReactNode | null;
  variant?: ListRowVariant;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/** A tappable row: an optional icon, a title with optional supporting text, and a trailing cue. */
export function ListRow({
  title,
  onPress,
  subtitle,
  overline,
  icon: Icon,
  iconColor,
  trailing,
  variant = 'filled',
  disabled = false,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const surface = variant === 'card' ? 'border border-border-light bg-bg-card' : 'bg-bg-overlay';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      className={`min-h-14 flex-row items-center gap-3 rounded-xl px-4 py-3 active:opacity-80 ${surface}`}
    >
      {Icon ? (
        <Icon size={theme.iconSize.md} color={iconColor ?? theme.colors.accent.primary} />
      ) : null}
      <View className="min-w-0 flex-1">
        {overline ? (
          <Text className="text-xs font-semibold uppercase text-text-secondary">{overline}</Text>
        ) : null}
        <Text className="text-base font-semibold text-text-primary" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text className="text-xs text-text-secondary">{subtitle}</Text> : null}
      </View>
      {trailing === undefined ? (
        <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
      ) : (
        trailing
      )}
    </Pressable>
  );
}
