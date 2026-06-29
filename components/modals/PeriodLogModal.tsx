import { subDays, subWeeks } from 'date-fns';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { getPastPeriodQuickDates, type PeriodLogMode } from '@/constants/cycle';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useTheme } from '@/hooks/useTheme';
import { getLocalCalendarYear, localCalendarDayDate, localDayStartMs } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';

import { CenteredModal } from './CenteredModal';
import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';

const TITLE_KEYS: Record<PeriodLogMode, string> = {
  end: 'cycle.periodLog.endTitle',
  past: 'cycle.periodLog.pastTitle',
  start: 'cycle.periodLog.startTitle',
};

const DESCRIPTION_KEYS: Record<PeriodLogMode, string> = {
  end: 'cycle.periodLog.endDescription',
  past: 'cycle.periodLog.pastDescription',
  start: 'cycle.periodLog.startDescription',
};

type PeriodLogModalProps = {
  visible: boolean;
  onClose: () => void;
  /** When true, the modal logs period end instead of period start */
  mode?: PeriodLogMode;
  initialDate?: Date;
};

export function PeriodLogModal({
  visible,
  onClose,
  mode = 'start',
  initialDate,
}: PeriodLogModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { logPeriodStart, logPeriodEnd, addPastPeriod, activePeriodLog } = useMenstrualCycle();

  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    localCalendarDayDate(initialDate ?? new Date())
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const titleKey = TITLE_KEYS[mode];
  const descriptionKey = DESCRIPTION_KEYS[mode];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dateMs = localDayStartMs(selectedDate);

      if (mode === 'end') {
        await logPeriodEnd(dateMs);
      } else if (mode === 'past') {
        await addPastPeriod({ startDate: dateMs });
      } else {
        await logPeriodStart({ startDate: dateMs });
      }

      onClose();
    } catch (error) {
      handleError(error, 'PeriodLogModal.handleSave', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const now = new Date();
  const quickDates =
    mode === 'past'
      ? getPastPeriodQuickDates(t)
      : [
          { label: t('common.yesterday'), date: localCalendarDayDate(subDays(now, 1)) },
          { label: t('common.oneWeekAgo'), date: localCalendarDayDate(subWeeks(now, 1)) },
          {
            label: t('common.weeksAgo', { count: 2 }),
            date: localCalendarDayDate(subWeeks(now, 2)),
          },
        ];

  return (
    <CenteredModal
      visible={visible}
      onClose={onClose}
      title={t(titleKey)}
      footer={
        <View className="flex-row gap-4">
          <Button label={t('common.cancel')} onPress={onClose} variant="outline" width="flex-1" />
          <Button
            label={t('common.save')}
            onPress={handleSave}
            variant="accent"
            width="flex-1"
            loading={isSaving}
          />
        </View>
      }
    >
      <View className="gap-4">
        <Text className="text-sm text-text-secondary">{t(descriptionKey)}</Text>

        {mode === 'end' && activePeriodLog ? (
          <View
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: theme.colors.background.card }}
          >
            <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {t('cycle.periodLog.startedOn')}
            </Text>
            <Text className="mt-1 text-base font-bold text-text-primary">
              {new Date(activePeriodLog.startDate).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
        ) : null}

        <DatePickerInput
          label={
            mode === 'end' ? t('cycle.periodLog.endDateLabel') : t('cycle.periodLog.startDateLabel')
          }
          selectedDate={selectedDate}
          onPress={() => setIsDatePickerVisible(true)}
        />

        {mode !== 'end' ? (
          <TouchableOpacity
            onPress={() => {
              setSelectedDate(localCalendarDayDate(new Date()));
            }}
            className="self-start"
          >
            <Text style={{ color: theme.colors.accent.primary }} className="text-sm">
              {t('cycle.periodLog.useToday')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(localCalendarDayDate(date));
          setIsDatePickerVisible(false);
        }}
        maxYear={getLocalCalendarYear(new Date())}
        quickDates={quickDates}
      />
    </CenteredModal>
  );
}
