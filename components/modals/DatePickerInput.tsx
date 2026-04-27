import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { Calendar, Edit, SquarePen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useTheme } from '@/hooks/useTheme';

export type DatePickerInputProps = {
  selectedDate: Date;
  onPress: () => void;
  onClear?: () => void;
  clearLabel?: string;
  alignDateContentEnd?: boolean;
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
  showClearButton?: boolean;
};

export function DatePickerInput({
  selectedDate,
  onPress,
  onClear,
  clearLabel,
  alignDateContentEnd = false,
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
  showClearButton = false,
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
        <Text className="text-text-primary text-xl font-semibold">{display}</Text>
        <Edit size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
      </Pressable>
    );
  }

  const showUnsetPlaceholder = Boolean(unset && unsetPlaceholder);
  const showClearCta = Boolean(showClearButton && !unset && onClear);
  const alignDateEnd = alignDateContentEnd || showClearCta;
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
    <View className={`min-w-0 ${className ?? ''}`}>
      {!hideLabel ? (
        <Text className="text-text-secondary mb-2 text-xs font-bold tracking-wider uppercase">
          {label ?? t('food.foodDetails.date')}
        </Text>
      ) : null}
      <View
        className={
          embedded
            ? `${pressableSurfaceClasses} min-w-0 flex-row items-center overflow-hidden`
            : `${pressableSurfaceClasses} flex-row items-center`
        }
      >
        <View className={rowClasses}>
          <Pressable
            accessibilityRole="button"
            className="min-w-0 flex-1"
            onPress={onPress}
            disabled={disabled}
          >
            <View
              className={`min-w-0 flex-row items-center ${isCompact ? 'gap-2' : 'gap-3'} ${
                alignDateEnd ? 'pr-3' : ''
              }`}
            >
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
              <View className={`min-w-0 flex-1 ${alignDateEnd ? 'items-end' : ''}`}>
                {showUnsetPlaceholder ? (
                  <Text
                    className={`text-text-tertiary font-medium ${alignDateEnd ? 'text-right' : ''}`}
                    numberOfLines={singleLine ? 1 : undefined}
                    ellipsizeMode="tail"
                  >
                    {unsetPlaceholder}
                  </Text>
                ) : singleLine ? (
                  <Text
                    className={`text-text-primary font-semibold ${alignDateEnd ? 'text-right' : ''}`}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {isSameDay(selectedDate, new Date())
                      ? t('food.foodDetails.today')
                      : format(selectedDate, 'MMM d, yyyy', { locale: dateFnsLocale })}
                  </Text>
                ) : (
                  <>
                    <Text
                      className={`text-text-primary font-medium ${alignDateEnd ? 'text-right' : ''}`}
                    >
                      {isSameDay(selectedDate, new Date())
                        ? t('food.foodDetails.today')
                        : format(selectedDate, 'EEEE', { locale: dateFnsLocale })}
                    </Text>
                    <Text
                      className={`text-text-secondary text-xs ${alignDateEnd ? 'text-right' : ''}`}
                    >
                      {format(selectedDate, 'MMMM d, yyyy', { locale: dateFnsLocale })}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </Pressable>
          {showClearCta ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('datePicker.clearDate')}
              className="ml-auto shrink-0 flex-row items-center gap-1 pl-2"
              onPress={onClear}
              disabled={disabled}
              hitSlop={8}
            >
              <SquarePen size={theme.iconSize.xs} color={theme.colors.accent.secondary} />
              <Text className="text-accent-secondary text-sm font-medium">
                {clearLabel ?? t('datePicker.clearDate')}
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
