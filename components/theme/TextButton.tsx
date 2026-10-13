import type { LucideIcon } from 'lucide-react-native';
import { type AccessibilityState, Pressable, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * `accent` for an ordinary secondary action ("Show all", "Edit goal"), `danger` for a quiet
 * destructive one that must not compete with the primary button beside it ("Discard"), `muted`
 * for an opt-out ("No gym").
 */
export type TextButtonTone = 'accent' | 'danger' | 'muted';

type TextButtonProps = {
  label: string;
  onPress?: () => void;
  tone?: TextButtonTone;
  icon?: LucideIcon;
  /** `right` for a disclosure chevron that follows the label. */
  iconPosition?: 'left' | 'right';
  /** `start` hugs the label (left-aligned in a column); `center` fills the row and centers it. */
  align?: 'start' | 'center';
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  testID?: string;
};

/**
 * A text-only action: the lowest-emphasis button, for a secondary step beside a `Button`. The
 * label alone is the visible surface, so the touch target is padded to the 44pt minimum.
 */
export function TextButton({
  label,
  onPress,
  tone = 'accent',
  icon: Icon,
  iconPosition = 'left',
  align = 'start',
  disabled = false,
  accessibilityLabel,
  accessibilityState,
  testID,
}: TextButtonProps) {
  const theme = useTheme();
  const toneColor = {
    accent: theme.colors.accent.primary,
    danger: theme.colors.status.error,
    muted: theme.colors.text.secondary,
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      className={`min-h-11 flex-row items-center gap-2 active:opacity-70 ${align === 'start' ? 'self-start' : 'justify-center'} ${disabled ? 'opacity-50' : ''}`}
    >
      {Icon && iconPosition === 'left' ? <Icon size={theme.iconSize.sm} color={toneColor} /> : null}
      <Text className="text-sm font-semibold" style={{ color: toneColor }}>
        {label}
      </Text>
      {Icon && iconPosition === 'right' ? (
        <Icon size={theme.iconSize.sm} color={toneColor} />
      ) : null}
    </Pressable>
  );
}
