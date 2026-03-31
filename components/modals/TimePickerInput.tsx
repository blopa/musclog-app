import { format, isSameMinute } from 'date-fns';
import { Clock, Edit } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useDateFnsLocale } from '../../hooks/useDateFnsLocale';
import { useTheme } from '../../hooks/useTheme';

export type TimePickerInputProps = {
  selectedTime: Date;
  onPress: () => void;
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
};

export function TimePickerInput({
  selectedTime,
  onPress,
  label,
  hideLabel = false,
  variant = 'compact',
  unset = false,
  unsetPlaceholder,
  disabled = false,
  className,
  embedded = false,
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
        <Text className="text-xl font-semibold text-text-primary">{display}</Text>
        <Edit size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
      </Pressable>
    );
  }

  const showUnsetPlaceholder = Boolean(unset && unsetPlaceholder);
  const pressableSurfaceClasses = embedded
    ? 'rounded-lg bg-transparent'
    : `rounded-lg border border-white/10 bg-bg-cardDark`;

  const rowClasses = embedded
    ? 'flex-row items-center justify-between p-0'
    : `flex-row items-center justify-between ${isCompact ? 'p-3' : 'p-4'}`;

  const TrailingIcon = (
    <Edit
      size={isCompact ? theme.iconSize.xs : theme.iconSize.sm}
      color={theme.colors.text.secondary}
    />
  );

  return (
    <View className={className}>
      {!hideLabel ? (
        <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
          {label ?? t('food.foodDetails.time')}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        className={pressableSurfaceClasses}
        onPress={onPress}
        disabled={disabled}
      >
        <View className={rowClasses}>
          <View className={`min-w-0 flex-1 flex-row items-center ${isCompact ? 'gap-2' : 'gap-3'}`}>
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
                <Text className="font-medium text-text-tertiary">{unsetPlaceholder}</Text>
              ) : (
                <>
                  <Text className="font-medium text-text-primary">
                    {matchesNow
                      ? t('timePicker.now')
                      : format(selectedTime, 'p', { locale: dateFnsLocale })}
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    {matchesNow
                      ? format(selectedTime, 'p', { locale: dateFnsLocale })
                      : format(selectedTime, 'zzzz', { locale: dateFnsLocale })}
                  </Text>
                </>
              )}
            </View>
          </View>
          {TrailingIcon ? (
            <View className="shrink-0 justify-center pl-2">{TrailingIcon}</View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}
