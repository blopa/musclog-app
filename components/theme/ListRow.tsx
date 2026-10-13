import { CheckCircle2, ChevronRight, Circle, type LucideIcon } from 'lucide-react-native';
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
  /**
   * Makes the row one choice among several (a radio): pass `true`/`false` for whether it is the
   * picked one. Leave it out for an ordinary tappable row. A choice shows its own check instead of
   * a chevron, unless `trailing` says otherwise.
   */
  selected?: boolean;
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
  selected,
  disabled = false,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const isChoice = selected !== undefined;
  const surface = variant === 'card' ? 'border border-border-light bg-bg-card' : 'bg-bg-overlay';
  // A choice always carries a border so picking one does not shift its neighbours.
  let choiceBorder = '';
  if (isChoice) {
    choiceBorder = selected ? 'border-2 border-accent-primary' : 'border-2 border-transparent';
  }

  let defaultTrailing: ReactNode = (
    <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
  );
  if (isChoice) {
    defaultTrailing = selected ? (
      <CheckCircle2 size={theme.iconSize.md} color={theme.colors.accent.primary} />
    ) : (
      <Circle size={theme.iconSize.md} color={theme.colors.text.tertiary} />
    );
  }

  return (
    <Pressable
      accessibilityRole={isChoice ? 'radio' : 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={isChoice ? { selected, disabled } : { disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      className={`min-h-14 flex-row items-center gap-3 rounded-xl px-4 py-3 active:opacity-80 ${surface} ${choiceBorder}`}
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
      {trailing === undefined ? defaultTrailing : trailing}
    </Pressable>
  );
}
