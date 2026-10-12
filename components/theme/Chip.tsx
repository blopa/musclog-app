import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * - `outline`: a choice among several, selected = accent-tinted fill and accent border (gym
 *   equipment, weight-unit override, restriction kind, injury expiry).
 * - `solid`: a compact action or a single-letter choice on the overlay surface, selected = full
 *   accent fill (the session action chips, the review weekday, the rest-timer presets).
 */
export type ChipVariant = 'outline' | 'solid';

/**
 * `radio`/`checkbox` report `selected` as checked to a screen reader; `button` is a plain action
 * that has no selected state of its own.
 */
export type ChipRole = 'radio' | 'checkbox' | 'button';

type ChipProps = {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  variant?: ChipVariant;
  role?: ChipRole;
  icon?: LucideIcon;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/** A pill-shaped choice or compact action. Always at least 44pt tall. */
export function Chip({
  label,
  onPress,
  selected = false,
  variant = 'outline',
  role = 'radio',
  icon: Icon,
  disabled = false,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const isOutline = variant === 'outline';

  let surface: string;
  let ink: string;
  let textClass: string;
  if (isOutline) {
    surface = selected
      ? 'border-accent-primary bg-accent-primary/20'
      : 'border-border-light bg-bg-card';
    ink = selected ? theme.colors.accent.primary : theme.colors.text.primary;
    textClass = selected ? 'text-accent-primary' : 'text-text-primary';
  } else {
    surface = selected
      ? 'border-transparent bg-accent-primary'
      : 'border-transparent bg-bg-overlay';
    ink = selected ? theme.colors.text.onAccent : theme.colors.text.primary;
    textClass = selected ? 'text-text-on-accent' : 'text-text-primary';
  }
  if (disabled) {
    ink = theme.colors.text.tertiary;
    textClass = 'text-text-tertiary';
  }

  const checked = role === 'button' ? undefined : selected;

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, selected: checked, disabled }}
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      className={`min-h-11 min-w-11 flex-row items-center justify-center gap-1.5 rounded-full border px-4 active:opacity-70 ${surface}`}
    >
      {Icon ? <Icon size={theme.iconSize.sm} color={ink} /> : null}
      <Text className={`text-sm font-semibold ${textClass}`}>{label}</Text>
    </Pressable>
  );
}
