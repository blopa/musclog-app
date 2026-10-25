import { Check, CheckCircle2, ChevronRight, Circle } from 'lucide-react-native';
import { type ComponentType, type ReactNode, useContext } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ListGroupContext } from '@/components/theme/ListGroup';
import { useTheme } from '@/hooks/useTheme';

/**
 * - `card`: a bordered card row, for a list of records (past reviews).
 * - `filled`: the overlay surface, for an action inside a card or sheet (the "Why?" actions,
 *   today's workouts, the rule summary).
 * - `grouped`: no surface or radius of its own; it lives inside a `ListGroup`, which supplies both
 *   and the hairlines between rows.
 */
export type ListRowVariant = 'card' | 'filled' | 'grouped';

type ListRowProps = {
  title: string;
  onPress?: () => void;
  /** One line under the title. */
  subtitle?: string;
  /** Small label above the title. */
  overline?: string;
  icon?: ComponentType<{ size: number; color: string }>;
  iconColor?: string;
  /** Overrides the title color (a destructive row uses the error color). */
  titleColor?: string;
  /**
   * The row's current value ("Unrated", "RIR 2"), shown before the chevron. Use this rather than
   * `trailing` for a row that opens something: `trailing` replaces the chevron, and a value with
   * no chevron next to it reads as a label, not as something to tap.
   */
  value?: string;
  /** Replaces the default chevron (a play icon, a spinner). `null` shows nothing. */
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
  titleColor,
  value,
  trailing,
  variant = 'filled',
  selected,
  disabled = false,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const isChoice = selected !== undefined;
  const isGrouped = variant === 'grouped';
  const { flush } = useContext(ListGroupContext);
  let surface = 'rounded-xl bg-bg-overlay';
  if (variant === 'card') {
    surface = 'rounded-xl border border-border-light bg-bg-card';
  } else if (isGrouped) {
    surface = '';
  }

  // A choice always carries a border so picking one does not shift its neighbours.
  let choiceBorder = '';
  // Inside a group the hairlines already separate the rows; the icon and the check mark the pick.
  if (isChoice && !isGrouped) {
    choiceBorder = selected ? 'border-2 border-accent-primary' : 'border-2 border-transparent';
  }

  let defaultTrailing: ReactNode = (
    <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
  );
  if (isChoice && isGrouped) {
    defaultTrailing = selected ? (
      <Check size={theme.iconSize.md} color={theme.colors.accent.primary} />
    ) : null;
  } else if (isChoice) {
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
      accessibilityHint={subtitle}
      accessibilityState={isChoice ? { selected, disabled } : { disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      android_ripple={isGrouped ? { color: theme.colors.background.ink10 } : undefined}
      className={`flex-row items-center gap-3 py-3 ${
        flush && isGrouped ? 'min-h-14 px-6 active:bg-ink/5' : 'px-4 active:opacity-80'
      } ${isGrouped && !flush ? 'min-h-[52px]' : 'min-h-14'} ${surface} ${choiceBorder}`}
    >
      {Icon ? (
        <Icon
          size={theme.iconSize.md}
          color={
            iconColor ?? (isGrouped ? theme.colors.text.secondary : theme.colors.accent.primary)
          }
        />
      ) : null}
      <View className="min-w-0 flex-1">
        {overline ? (
          <Text className="text-xs font-semibold text-text-secondary">{overline}</Text>
        ) : null}
        <Text
          className="text-base font-semibold text-text-primary"
          style={titleColor ? { color: titleColor } : undefined}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-text-secondary" numberOfLines={isGrouped ? 1 : undefined}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text className="shrink-0 text-sm text-text-secondary" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing === undefined ? defaultTrailing : trailing}
    </Pressable>
  );
}
