import { LinearGradient } from 'expo-linear-gradient';
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
  const containerBase = 'flex-row rounded-lg';
  const segmentBorderRadius = theme.borderRadius.xs;

  const getContainerClass = (variant: SegmentedControlVariant): string => {
    switch (variant) {
      case 'elevated':
        return `${containerBase} bg-bg-cardElevated shadow-md`;
      case 'gradient':
        return `${containerBase} bg-bg-cardElevated`;
      case 'outline':
        return `${containerBase} bg-transparent border border-border-light`;
      case 'pill':
        return `flex-row rounded-full bg-bg-overlay p-1 ${fullWidth ? 'self-stretch' : 'self-start'}`;
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
              className={`min-h-9 flex-row items-center gap-1.5 rounded-full px-3 ${fullWidth ? 'flex-1 justify-center' : ''} ${isSelected ? 'bg-accent-primary' : ''}`}
            >
              {renderIcon(option, isSelected)}
              <Text
                className={`text-sm font-semibold ${isSelected ? 'text-text-on-accent' : 'text-text-secondary'}`}
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
        height: theme.size['14'],
        paddingHorizontal: theme.spacing.padding['1half'],
        paddingVertical: theme.spacing.padding['1half'],
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
            className="flex-1 justify-center self-stretch"
            style={{ borderRadius: segmentBorderRadius }}
            onPress={() => onValueChange(option.value)}
            {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
          >
            {isSelected ? (
              <LinearGradient
                colors={theme.colors.gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flex: 1,
                  borderRadius: segmentBorderRadius,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: theme.colors.accent.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <View className="flex-row items-center justify-center gap-1.5">
                  {renderIcon(option, isSelected)}
                  <Text className={`text-center ${labelSize} font-bold text-text-on-accent`}>
                    {option.label}
                  </Text>
                </View>
              </LinearGradient>
            ) : (
              <View className="flex-row items-center justify-center gap-1.5">
                {renderIcon(option, isSelected)}
                <Text className={`text-center ${labelSize} font-bold text-text-secondary`}>
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
                <Text className="text-[10px] font-bold leading-none text-text-always-white">
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
