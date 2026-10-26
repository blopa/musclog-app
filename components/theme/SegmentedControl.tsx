import { ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type Option = {
  label: string;
  value: string;
  /**
   * A node, or a render function when the icon's ink must follow the selected state. A selected
   * segment sits on the accent, so a coloured icon needs the function form (`text.onAccent` when
   * selected, `text.secondary` otherwise).
   */
  icon?: ReactNode | ((selected: boolean) => ReactNode);
  /** Unread-style count pinned to the segment's top-right corner. Hidden when 0 or omitted. */
  badge?: number;
};

/**
 * Every variant marks the selected segment the same way — the accent with `text.onAccent` ink — and
 * differs only in its track: `elevated` (raised), `gradient` (flat, smaller labels), `outline`
 * (bordered). They are for switching what a screen shows or edits. The selected segment used to be
 * `bg-card` on the `bg-cardElevated` track outside `gradient`, which was barely visible.
 *
 * `pill` is the compact form: a rounded-full track, the selected option filled with the accent. It
 * hugs its options when it sits inline beside other content (the workout session's view toggle),
 * and takes `fullWidth` when it is its own row in a list of settings (the notification settings),
 * so every control lines up with the cards and toggles around it instead of leaving a ragged
 * edge. Use one form per screen: mixing them makes the same kind of choice look like two
 * different controls.
 */
type SegmentedControlVariant = 'elevated' | 'outline' | 'gradient' | 'pill';

type TestSegmentedControlProps = {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  variant?: SegmentedControlVariant;
  /** `pill` only: stretch the track to its container and share it evenly between the options. */
  fullWidth?: boolean;
};

export function SegmentedControl({
  options,
  value,
  onValueChange,
  variant = 'elevated',
  fullWidth = false,
}: TestSegmentedControlProps) {
  const theme = useTheme();
  const containerBase = 'flex-row rounded-control';
  const segmentBorderRadius = theme.borderRadius.xs;

  const getContainerClass = (variant: SegmentedControlVariant): string => {
    switch (variant) {
      case 'elevated':
        return `${containerBase} bg-bg-cardElevated`;
      case 'gradient':
        return `${containerBase} bg-bg-cardElevated`;
      case 'outline':
        return `${containerBase} bg-transparent border border-border-light`;
      case 'pill':
        return `flex-row rounded-control bg-bg-overlay p-1 ${fullWidth ? 'self-stretch' : 'self-start'}`;
      default:
        return `${containerBase} bg-bg-card`;
    }
  };

  const containerClass = getContainerClass(variant);
  const labelSize = variant === 'gradient' ? 'text-xs' : 'text-sm';
  const renderIcon = (option: Option, isSelected: boolean) =>
    typeof option.icon === 'function' ? option.icon(isSelected) : option.icon;

  if (variant === 'pill') {
    return (
      <View className={containerClass} accessibilityRole="radiogroup">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected, checked: isSelected }}
              onPress={() => onValueChange(option.value)}
              // The track's padding brings the pill to the 44pt target.
              hitSlop={{ top: 4, bottom: 4 }}
              className={`min-h-9 min-w-0 flex-row items-center gap-1.5 rounded-inner px-3 py-2 ${fullWidth ? 'flex-1 justify-center' : ''} ${isSelected ? 'bg-accent-primary' : ''}`}
            >
              {renderIcon(option, isSelected)}
              <Text
                // Android pads the glyph box asymmetrically, which sat the label below the icon.
                style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                className={`min-w-0 shrink text-center text-sm font-medium leading-5 ${isSelected ? 'text-text-on-accent' : 'text-text-secondary'}`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View
      className={containerClass}
      accessibilityRole="radiogroup"
      style={{
        // Allow translated labels and larger accessibility text to grow the track.
        minHeight: theme.size['12'],
        padding: theme.spacing.padding.xs,
        gap: theme.spacing.gap.xs,
      }}
    >
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected, checked: isSelected }}
            className="min-w-0 flex-auto justify-center self-stretch"
            // 40pt drawn; the track's padding takes the touch target to 48.
            hitSlop={{ top: 4, bottom: 4 }}
            style={{ borderRadius: segmentBorderRadius, minHeight: theme.size['10'] }}
            onPress={() => onValueChange(option.value)}
            {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
          >
            {isSelected ? (
              <View
                style={{
                  flexGrow: 1,
                  paddingHorizontal: theme.spacing.padding.sm,
                  paddingVertical: theme.spacing.padding['1half'],
                  borderRadius: segmentBorderRadius,
                  backgroundColor: theme.colors.accent.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View className="min-w-0 flex-row items-center justify-center gap-1.5 self-stretch">
                  {renderIcon(option, isSelected)}
                  <Text
                    className={`min-w-0 shrink text-center ${labelSize} font-semibold text-text-on-accent`}
                  >
                    {option.label}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="min-w-0 flex-row items-center justify-center gap-1.5 px-2 py-1.5">
                {renderIcon(option, isSelected)}
                <Text
                  className={`min-w-0 shrink text-center ${labelSize} font-medium text-text-secondary`}
                >
                  {option.label}
                </Text>
              </View>
            )}
            {option.badge ? (
              <View
                className="absolute -right-1 -top-1 h-4 items-center justify-center rounded-full px-1"
                style={{
                  backgroundColor: theme.colors.status.notificationBadge,
                  minWidth: theme.size['4'],
                }}
              >
                <Text className="text-[10px] font-semibold leading-none text-text-always-white">
                  {option.badge > 9 ? '9+' : option.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
