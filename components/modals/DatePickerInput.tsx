import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { Calendar, Edit } from 'lucide-react-native';
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
  /** When false, the left calendar chip is omitted (parent row already shows a calendar). */
  showLeadingIcon?: boolean;
  /**
   * `stacked` — weekday + full date (default).
   * `single-line` — one short date line (e.g. embedded in nutrition goal rows).
   */
  dateDisplay?: 'stacked' | 'single-line';
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
  showLeadingIcon = true,
  dateDisplay = 'stacked',
}: DatePickerInputProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();
  const isCompact = variant === 'compact';
  const singleLine = dateDisplay === 'single-line';

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
        <Edit size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
      </Pressable>
    );
  }

  const showUnsetPlaceholder = Boolean(unset && unsetPlaceholder);
  const pressableSurfaceClasses = embedded
    ? 'rounded-lg bg-transparent'
    : `rounded-lg border border-white/10 bg-bg-cardDark`;

  const rowClasses = embedded
    ? 'min-w-0 flex-1 flex-row items-center justify-between overflow-hidden p-0'
    : `flex-row items-center justify-between ${isCompact ? 'p-3' : 'p-4'}`;

  const TrailingIcon = (
    <Edit
      size={isCompact ? theme.iconSize.xs : theme.iconSize.sm}
      color={theme.colors.text.secondary}
    />
  );

  return (
    <View className={`min-w-0 ${className ?? ''}`}>
      {!hideLabel ? (
        <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
          {label ?? t('food.foodDetails.date')}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        className={
          embedded
            ? `${pressableSurfaceClasses} min-w-0 flex-1 overflow-hidden`
            : pressableSurfaceClasses
        }
        onPress={onPress}
        disabled={disabled}
      >
        <View className={rowClasses}>
          <View className={`min-w-0 flex-1 flex-row items-center ${isCompact ? 'gap-2' : 'gap-3'}`}>
            {showLeadingIcon ? (
              <View
                className={`flex-shrink-0 items-center justify-center rounded-full ${isCompact ? 'h-8 w-8' : 'h-10 w-10'}`}
                style={{
                  backgroundColor: theme.colors.status.indigo20,
                }}
              >
                <Calendar
                  size={isCompact ? theme.iconSize.sm : theme.iconSize.md}
                  color={theme.colors.accent.primary}
                />
              </View>
            ) : null}
            <View className="min-w-0 flex-1">
              {showUnsetPlaceholder ? (
                <Text
                  className="font-medium text-text-tertiary"
                  numberOfLines={singleLine ? 1 : undefined}
                  ellipsizeMode="tail"
                >
                  {unsetPlaceholder}
                </Text>
              ) : singleLine ? (
                <Text
                  className="font-semibold text-text-primary"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {isSameDay(selectedDate, new Date())
                    ? t('food.foodDetails.today')
                    : format(selectedDate, 'MMM d, yyyy', { locale: dateFnsLocale })}
                </Text>
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
