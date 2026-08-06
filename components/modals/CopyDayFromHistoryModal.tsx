import { CalendarDays, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { type RecentLoggedDay, useCopyDaySource } from '@/hooks/useCopyDaySource';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import {
  calendarDateFromRecordDay,
  formatUtcNormalizedDayWithWeekdayIntl,
  localCalendarDayDate,
  localCalendarDayPlusDays,
  utcDayKeyFromLocalDate,
} from '@/utils/calendarDate';
import {
  allCopyDayItemIds,
  type CopyDayItem,
  copyDaySelectionSummary,
  selectedLogIds,
} from '@/utils/copyDaySelection';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';

type CopyDayFromHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  /** The day being copied into. */
  targetDate: Date;
  /** Items already logged on the target day — drives the "will be added on top" note. */
  targetDayItemCount: number;
  onConfirm: (logIds: string[], sourceDate: Date) => Promise<void>;
  isLoading?: boolean;
};

/** A UTC-normalized day key rendered as a device-local Date for pickers and queries. */
function localDateFromDayKey(dayKey: number): Date {
  return calendarDateFromRecordDay(dayKey, '+00:00');
}

export function CopyDayFromHistoryModal({
  visible,
  onClose,
  targetDate,
  targetDayItemCount,
  onConfirm,
  isLoading = false,
}: CopyDayFromHistoryModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger, locale } = useFormatAppNumber();

  const [sourceDate, setSourceDate] = useState<Date | null>(null);
  const [deselectedItemIds, setDeselectedItemIds] = useState<ReadonlySet<string>>(new Set());
  const [isDatePickerVisible, setIsDatePickerVisible] = useSubModalVisibility(visible);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isLoading || isSubmitting;

  const { recentDays, isLoadingRecentDays, sections, isLoadingPreview, isSourceEmpty } =
    useCopyDaySource({ enabled: visible, targetDate, sourceDate });

  useEffect(() => {
    const reset = () => {
      if (!visible) {
        setSourceDate(null);
        setDeselectedItemIds(new Set());
        setIsSubmitting(false);
      }
    };
    reset();
  }, [visible]);

  const chooseSourceDate = (date: Date) => {
    setSourceDate(localCalendarDayDate(date));
    // A different day is a different set of rows; start it fully ticked.
    setDeselectedItemIds(new Set());
  };

  const toggleItem = (itemId: string) => {
    setDeselectedItemIds((previous) => {
      const next = new Set(previous);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const summary = copyDaySelectionSummary(sections, deselectedItemIds);
  const allIds = allCopyDayItemIds(sections);
  const isEverythingSelected = summary.itemCount === allIds.length && allIds.length > 0;

  const toggleSelectAll = () => {
    setDeselectedItemIds(isEverythingSelected ? new Set(allIds) : new Set());
  };

  const handleConfirm = async () => {
    if (isBusy || !sourceDate) {
      return;
    }

    setIsSubmitting(true);
    await flushLoadingPaint();
    try {
      await onConfirm(selectedLogIds(sections, deselectedItemIds), sourceDate);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConfirmDisabled = isBusy || !sourceDate || summary.itemCount === 0;
  // Copying "today into today" would just duplicate the day, and the source list already
  // excludes it — cap the manual picker at yesterday so the two agree.
  const latestSelectableSourceDate = localCalendarDayPlusDays(targetDate, -1);

  const renderRecentDay = (day: RecentLoggedDay) => {
    const isSelected = sourceDate !== null && utcDayKeyFromLocalDate(sourceDate) === day.dayKey;

    return (
      <Pressable
        key={day.dayKey}
        className="flex-row items-center justify-between rounded-xl border px-4 py-3"
        style={{
          borderColor: isSelected ? theme.colors.accent.primary : theme.colors.background.white10,
          backgroundColor: isSelected
            ? theme.colors.accent.primary10
            : theme.colors.background.white5,
        }}
        onPress={() => chooseSourceDate(localDateFromDayKey(day.dayKey))}
      >
        <Text
          className="font-semibold"
          style={{
            color: isSelected ? theme.colors.accent.primary : theme.colors.text.primary,
            fontSize: theme.typography.fontSize.sm,
          }}
        >
          {formatUtcNormalizedDayWithWeekdayIntl(day.dayKey, locale)}
        </Text>
        <Text
          style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.xs }}
        >
          {t('food.actions.copyDayRecentDaySummary', {
            count: day.itemCount,
            calories: formatInteger(day.calories),
          })}
        </Text>
      </Pressable>
    );
  };

  const renderItem = (item: CopyDayItem) => {
    const isSelected = !deselectedItemIds.has(item.id);

    return (
      <Pressable
        key={item.id}
        className="flex-row items-center gap-3 py-2"
        onPress={() => toggleItem(item.id)}
      >
        <View
          className="h-5 w-5 items-center justify-center rounded-md border"
          style={{
            borderColor: isSelected ? theme.colors.accent.primary : theme.colors.background.white20,
            backgroundColor: isSelected ? theme.colors.accent.primary10 : 'transparent',
          }}
        >
          {isSelected ? (
            <Check size={theme.iconSize.sm} color={theme.colors.accent.primary} />
          ) : null}
        </View>
        <Text
          className="flex-1"
          numberOfLines={1}
          style={{
            color: isSelected ? theme.colors.text.primary : theme.colors.text.secondary,
            fontSize: theme.typography.fontSize.sm,
          }}
        >
          {item.label}
        </Text>
        <Text
          style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.xs }}
        >
          {t('food.actions.copyDayItemCalories', { calories: formatInteger(item.calories) })}
        </Text>
      </Pressable>
    );
  };

  const renderPreview = () => {
    if (sourceDate === null) {
      return null;
    }

    if (isLoadingPreview) {
      return (
        <View className="items-center py-6">
          <ActivityIndicator color={theme.colors.accent.primary} />
        </View>
      );
    }

    if (isSourceEmpty) {
      return (
        <Text
          className="py-4 text-center"
          style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
        >
          {t('food.actions.copyDaySourceEmpty')}
        </Text>
      );
    }

    return (
      <View className="gap-4">
        <View className="flex-row items-center justify-between">
          <Text
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('food.actions.copyDayItemsToCopy')}
          </Text>
          <Pressable onPress={toggleSelectAll}>
            <Text
              className="font-semibold"
              style={{
                color: theme.colors.accent.primary,
                fontSize: theme.typography.fontSize.xs,
              }}
            >
              {isEverythingSelected
                ? t('food.actions.copyDayDeselectAll')
                : t('food.actions.copyDaySelectAll')}
            </Text>
          </Pressable>
        </View>

        {sections.map((section) => (
          <View key={section.mealType} className="gap-1">
            <Text
              className="font-semibold"
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.xs,
              }}
            >
              {t(section.titleKey)}
            </Text>
            {section.items.map(renderItem)}
          </View>
        ))}
      </View>
    );
  };

  return (
    <BottomPopUp
      visible={visible}
      onClose={isBusy ? undefined : onClose}
      title={t('food.actions.copyDayModalTitle')}
      footer={
        <View className="gap-3">
          {summary.itemCount > 0 ? (
            <Text
              className="text-center"
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.xs,
              }}
            >
              {t('food.actions.copyDaySelectionSummary', {
                count: summary.itemCount,
                calories: formatInteger(summary.calories),
              })}
            </Text>
          ) : null}
          <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
            <Button
              label={t('common.cancel')}
              variant="outline"
              size="sm"
              width="flex-1"
              onPress={onClose}
              disabled={isBusy}
            />
            <Button
              label={t('common.confirm')}
              variant="gradientCta"
              size="sm"
              width="flex-1"
              onPress={handleConfirm}
              disabled={isConfirmDisabled}
              loading={isBusy}
            />
          </View>
        </View>
      }
    >
      <View
        className="gap-5"
        pointerEvents={isBusy ? 'none' : 'auto'}
        style={{ opacity: isBusy ? 0.65 : 1 }}
      >
        {/* Heads-up: the copy is additive, so say so before the user commits. */}
        {targetDayItemCount > 0 ? (
          <View
            className="flex-row items-center gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: theme.colors.status.info10 }}
          >
            <CalendarDays size={theme.iconSize.sm} color={theme.colors.status.info} />
            <Text
              className="flex-1"
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.xs,
              }}
            >
              {t('food.actions.copyDayTargetNotEmpty', { count: targetDayItemCount })}
            </Text>
          </View>
        ) : null}

        {/* Recent days that actually have food — faster than hunting through a calendar. */}
        <View className="gap-2">
          <Text
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('food.actions.copyDayRecentDays')}
          </Text>

          {isLoadingRecentDays ? (
            <View className="items-center py-4">
              <ActivityIndicator color={theme.colors.accent.primary} />
            </View>
          ) : (
            <View className="gap-2">
              {recentDays.length === 0 ? (
                <Text
                  style={{
                    color: theme.colors.text.secondary,
                    fontSize: theme.typography.fontSize.sm,
                  }}
                >
                  {t('food.actions.copyDayNoRecentDays')}
                </Text>
              ) : (
                recentDays.map(renderRecentDay)
              )}
            </View>
          )}
        </View>

        {/* Older than the recent window: fall back to the full picker. */}
        <DatePickerInput
          label={t('food.actions.sourceDate')}
          selectedDate={sourceDate ?? latestSelectableSourceDate}
          onPress={() => setIsDatePickerVisible(true)}
          disabled={isBusy}
          variant="compact"
        />

        {renderPreview()}
      </View>
      <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />

      {isDatePickerVisible ? (
        <DatePickerModal
          visible={isDatePickerVisible}
          onClose={() => setIsDatePickerVisible(false)}
          selectedDate={sourceDate ?? latestSelectableSourceDate}
          maxDate={latestSelectableSourceDate}
          quickDates={recentDays.slice(0, 3).map((day) => ({
            label: formatUtcNormalizedDayWithWeekdayIntl(day.dayKey, locale),
            date: localDateFromDayKey(day.dayKey),
          }))}
          onDateSelect={(date) => {
            chooseSourceDate(date);
            setIsDatePickerVisible(false);
          }}
        />
      ) : null}
    </BottomPopUp>
  );
}
