import { format, isSameMinute } from 'date-fns';
import { Clock, Edit, SquarePen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useTheme } from '@/hooks/useTheme';

export type TimePickerInputProps = {
  selectedTime: Date;
  onPress: () => void;
  onClear?: () => void;
  clearLabel?: string;
  /** When omitted, the label uses `food.foodDetails.time`. Ignored if `hideLabel` is true. */
  label?: string;
  hideLabel?: boolean;
  /**
   * `default` — full padding and icon sizes (e.g. food log details).
   * `compact` — tighter row (e.g. nested / secondary fields).
   * `inlineNav` — single-line value + small clock (e.g. day navigator bar).
   */
  variant?: 'default' | 'compact' | 'inlineNav';
  /** When true, show placeholder text instead of a real time (e.g. unset). */
  unset?: boolean;
  unsetPlaceholder?: string;
  disabled?: boolean;
  /** Tailwind classes on the outer wrapper `View`. */
  className?: string;
  /**
   * Use inside another surface: no outer border/background on the tap target
   * (e.g. nutrition goals row).
   */
  embedded?: boolean;
  showClearButton?: boolean;
};

export function TimePickerInput({
  selectedTime,
  onPress,
  onClear,
  clearLabel,
  label,
  hideLabel = false,
  variant = 'compact',
  unset = false,
  unsetPlaceholder,
  disabled = false,
  className,
  embedded = false,
  showClearButton = false,
}: TimePickerInputProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();
  const isCompact = variant === 'compact';
  const now = new Date();
  const matchesNow = isSameMinute(selectedTime, now);

  if (variant === 'inlineNav') {
    const display = format(selectedTime, 'p', { locale: dateFnsLocale });

    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={disabled}
        className={`flex-row items-center gap-2 ${className ?? ''}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Text className="text-text-primary text-xl font-semibold">{display}</Text>
        <Edit size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
      </Pressable>
    );
  }

  const showUnsetPlaceholder = Boolean(unset && unsetPlaceholder);
  const showClearCta = Boolean(showClearButton && !unset && onClear);
  const pressableSurfaceClasses = embedded
    ? 'rounded-lg bg-transparent'
    : `rounded-lg border border-white/10 bg-bg-cardDark`;

  const rowClasses = embedded
    ? 'min-w-0 w-full flex-row items-center overflow-hidden p-0'
    : `w-full flex-row items-center ${isCompact ? 'p-3' : 'p-4'}`;

  const TrailingIcon = (
    <Edit
      size={isCompact ? theme.iconSize.xs : theme.iconSize.sm}
      color={theme.colors.text.secondary}
    />
  );

  return (
    <View className={className}>
      {!hideLabel ? (
        <Text className="text-text-secondary mb-2 text-xs font-bold tracking-wider uppercase">
          {label ?? t('food.foodDetails.time')}
        </Text>
      ) : null}
      <View className={`${pressableSurfaceClasses} flex-row items-center`}>
        <View className={rowClasses}>
          <Pressable
            accessibilityRole="button"
            className="min-w-0 flex-1"
            onPress={onPress}
            disabled={disabled}
          >
            <View className={`min-w-0 flex-row items-center ${isCompact ? 'gap-2' : 'gap-3'}`}>
              <View
                className={`items-center justify-center rounded-full ${isCompact ? 'h-8 w-8' : 'h-10 w-10'}`}
                style={{
                  backgroundColor: theme.colors.status.indigo20,
                }}
              >
                <Clock
                  size={isCompact ? theme.iconSize.sm : theme.iconSize.md}
                  color={theme.colors.accent.primary}
                />
              </View>
              <View className="min-w-0 flex-1">
                {showUnsetPlaceholder ? (
                  <Text className="text-text-tertiary font-medium">{unsetPlaceholder}</Text>
                ) : (
                  <>
                    <Text className="text-text-primary font-medium">
                      {matchesNow
                        ? t('timePicker.now')
                        : format(selectedTime, 'p', { locale: dateFnsLocale })}
                    </Text>
                    <Text className="text-text-secondary text-xs">
                      {matchesNow
                        ? format(selectedTime, 'p', { locale: dateFnsLocale })
                        : format(selectedTime, 'zzzz', { locale: dateFnsLocale })}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </Pressable>
          {showClearCta ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('timePicker.clearTime')}
              className="ml-auto shrink-0 flex-row items-center gap-1 pl-2"
              onPress={onClear}
              disabled={disabled}
              hitSlop={8}
            >
              <SquarePen size={theme.iconSize.xs} color={theme.colors.accent.secondary} />
              <Text className="text-accent-secondary text-sm font-medium">
                {clearLabel ?? t('timePicker.clearTime')}
              </Text>
            </Pressable>
          ) : TrailingIcon ? (
            <View className="shrink-0 justify-center pl-2">{TrailingIcon}</View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
