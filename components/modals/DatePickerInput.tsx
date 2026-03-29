import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { Calendar, ChevronDown, Edit } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useDateFnsLocale } from '../../hooks/useDateFnsLocale';
import { useTheme } from '../../hooks/useTheme';

export type DatePickerInputProps = {
  selectedDate: Date;
  onPress: () => void;
  /** When omitted, the label uses `food.foodDetails.date`. Ignored if `hideLabel` is true. */
  label?: string;
  hideLabel?: boolean;
  /**
   * `default` — full padding and icon sizes (e.g. food log details).
   * `compact` — tighter row (e.g. nested / secondary fields).
   * `inlineNav` — single-line label + small calendar (e.g. day navigator bar).
   */
  variant?: 'default' | 'compact' | 'inlineNav';
  /** When true, show placeholder text instead of a real date (e.g. unset DOB). */
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
  trailing?: 'edit' | 'chevron' | 'none';
};

export function DatePickerInput({
  selectedDate,
  onPress,
  label,
  hideLabel = false,
  variant = 'compact',
  unset = false,
  unsetPlaceholder,
  disabled = false,
  className,
  embedded = false,
  trailing = 'edit',
}: DatePickerInputProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();
  const isCompact = variant === 'compact';

  if (variant === 'inlineNav') {
    const display = isToday(selectedDate)
      ? t('datePicker.today')
      : isYesterday(selectedDate)
        ? t('datePicker.yesterday')
        : format(selectedDate, 'MMM d, yyyy', { locale: dateFnsLocale });

    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={disabled}
        className={`flex-row items-center gap-2 ${className ?? ''}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Text className="text-xl font-semibold text-text-primary">{display}</Text>
        <Calendar size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
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

  const TrailingIcon =
    trailing === 'chevron' ? (
      <ChevronDown size={theme.iconSize.sm} color={theme.colors.text.secondary} />
    ) : trailing === 'edit' ? (
      <Edit
        size={isCompact ? theme.iconSize.xs : theme.iconSize.sm}
        color={theme.colors.text.secondary}
      />
    ) : null;

  return (
    <View className={className}>
      {!hideLabel ? (
        <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
          {label ?? t('food.foodDetails.date')}
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
              <Calendar
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
                    {isSameDay(selectedDate, new Date())
                      ? t('food.foodDetails.today')
                      : format(selectedDate, 'EEEE', { locale: dateFnsLocale })}
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    {format(selectedDate, 'MMMM d, yyyy', { locale: dateFnsLocale })}
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
