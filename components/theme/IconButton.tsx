import type { LucideIcon } from 'lucide-react-native';
import { type AccessibilityState, Pressable } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export type IconButtonSize = 'sm' | 'md' | 'lg';

/**
 * - `filled`: the low-emphasis overlay surface (steppers, prev/next).
 * - `elevated`: a surface one step above a card, for controls that sit ON a card.
 * - `ghost`: no surface (top-bar back/more, a row's remove ×).
 * - `media`: a dark scrim with white ink, for controls over a photo or the camera, where the
 *   theme's own surfaces would not read.
 */
export type IconButtonVariant = 'filled' | 'elevated' | 'ghost' | 'media';

type IconButtonProps = {
  icon: LucideIcon;
  /** Required: an icon alone says nothing to a screen reader. */
  accessibilityLabel: string;
  onPress?: () => void;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  disabled?: boolean;
  /** Overrides the variant's ink, for an accent or destructive icon. */
  color?: string;
  accessibilityState?: AccessibilityState;
  testID?: string;
};

/**
 * Visual diameter per size. `sm` is drawn smaller than a touch target for dense rows, so it pads
 * its hit area out to 44pt with `hitSlop`; the other two are already at least 44pt.
 */
const SIZE = {
  sm: { box: 'h-9 w-9', icon: 'sm', hitSlop: 4 },
  md: { box: 'h-11 w-11', icon: 'md', hitSlop: 0 },
  lg: { box: 'h-12 w-12', icon: 'lg', hitSlop: 0 },
} as const;

/**
 * A button with a surface sits on the control radius like every other control; `ghost` has no
 * surface to shape and `media` stays round, the convention for a control floating over a photo.
 */
const SURFACE: Record<IconButtonVariant, string> = {
  filled: 'rounded-control bg-bg-overlay',
  elevated: 'rounded-control bg-bg-cardElevated',
  ghost: 'rounded-full',
  media: 'rounded-full',
};

/** An icon-only button. Use `Button` when the action has a visible label. */
export function IconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  size = 'md',
  variant = 'filled',
  disabled = false,
  color,
  accessibilityState,
  testID,
}: IconButtonProps) {
  const theme = useTheme();
  const config = SIZE[size];
  const isMedia = variant === 'media';
  let ink = color ?? (isMedia ? theme.colors.text.alwaysWhite : theme.colors.text.primary);
  if (disabled) {
    ink = isMedia ? theme.colors.overlay.alwaysWhite70 : theme.colors.text.tertiary;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={config.hitSlop}
      testID={testID}
      className={`items-center justify-center active:opacity-70 ${config.box} ${SURFACE[variant]}`}
      style={isMedia ? { backgroundColor: theme.colors.overlay.scrim60 } : undefined}
    >
      <Icon size={theme.iconSize[config.icon]} color={ink} />
    </Pressable>
  );
}
