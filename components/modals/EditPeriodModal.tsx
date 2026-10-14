import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { PeriodEndChoice } from '@/components/cycle/PeriodEndChoice';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { useSnackbar } from '@/context/SnackbarContext';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSubModalState, useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { getLocalCalendarYear, localCalendarDayDate, localDayStartMs } from '@/utils/calendarDate';
import { type EndChoice, endChoiceOf, resolveEnd } from '@/utils/cycle/periodEnd';
import { periodErrorKey } from '@/utils/cycle/periodErrors';
import type { CyclePeriodDto } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';

import { CenteredModal } from './CenteredModal';
import { ConfirmationModal } from './ConfirmationModal';
import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';

type EditPeriodModalProps = {
  visible: boolean;
  onClose: () => void;
  period: CyclePeriodDto | null;
  /** Only the most recent period can still be "ongoing". */
  isLatest: boolean;
};

/**
 * Corrects a logged period: its start, how it ended, and (via delete + undo) whether it should
 * exist at all. Overlaps are validated inside the write, so two quick edits cannot both pass.
 */
export function EditPeriodModal({ visible, onClose, period, isLatest }: EditPeriodModalProps) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { updatePeriod, removePeriod, restorePeriod, config } = useMenstrualCycle();
  const [startDate, setStartDate] = useState<Date>(() => localCalendarDayDate(new Date()));
  const [endChoice, setEndChoice] = useState<EndChoice>({ kind: 'unknown', date: null });
  const [picker, setPicker] = useSubModalState<'start' | 'end' | null>(visible, null);
  const [confirmDelete, setConfirmDelete] = useSubModalVisibility(visible);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible || !period) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      setStartDate(localCalendarDayDate(new Date(period.startDate)));
      setEndChoice(endChoiceOf(period));
    });

    return () => cancelAnimationFrame(frame);
  }, [visible, period]);

  if (!period) {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const start = localDayStartMs(startDate);
      await updatePeriod(period.id, {
        startDate: start,
        ...resolveEnd(endChoice, start, config.fallbackPeriodDuration),
      });
      onClose();
    } catch (error) {
      handleError(error, 'EditPeriodModal.save', { snackbarMessage: t(periodErrorKey(error)) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await removePeriod(period.id);
      setConfirmDelete(false);
      onClose();
      showSnackbar('success', t('cycle.edit.deleted'), {
        action: t('cycle.edit.undo'),
        duration: 8000,
        onAction: () => {
          void restorePeriod(period.id).catch((error) =>
            handleError(error, 'EditPeriodModal.undo', {
              snackbarMessage: t(periodErrorKey(error)),
            })
          );
        },
      });
    } catch (error) {
      handleError(error, 'EditPeriodModal.delete', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    }
  };

  const pickerDate =
    picker === 'end'
      ? localCalendarDayDate(new Date(endChoice.date ?? startDate.getTime()))
      : startDate;

  return (
    <CenteredModal
      visible={visible}
      onClose={onClose}
      title={t('cycle.edit.title')}
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
      <View className="gap-5">
        <DatePickerInput
          label={t('cycle.periodLog.startDateLabel')}
          selectedDate={startDate}
          onPress={() => setPicker('start')}
        />
        <PeriodEndChoice
          value={endChoice}
          onChange={setEndChoice}
          usualDuration={config.fallbackPeriodDuration}
          startDate={localDayStartMs(startDate)}
          allowOpen={isLatest}
          onPickDate={() => setPicker('end')}
        />
        <Text className="text-xs text-text-tertiary">{t('cycle.edit.recalculates')}</Text>
        <TextButton
          label={t('cycle.edit.delete')}
          tone="danger"
          onPress={() => setConfirmDelete(true)}
        />
      </View>

      <DatePickerModal
        visible={picker != null}
        onClose={() => setPicker(null)}
        selectedDate={pickerDate}
        onDateSelect={(date) => {
          if (picker === 'end') {
            setEndChoice({ kind: 'logged', date: localDayStartMs(date) });
          } else {
            setStartDate(localCalendarDayDate(date));
          }

          setPicker(null);
        }}
        minDate={picker === 'end' ? startDate : undefined}
        maxDate={localCalendarDayDate(new Date())}
        maxYear={getLocalCalendarYear(new Date())}
      />

      <ConfirmationModal
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={t('cycle.edit.deleteTitle')}
        message={t('cycle.edit.deleteMessage')}
        confirmLabel={t('cycle.edit.delete')}
        variant="destructive"
      />
    </CenteredModal>
  );
}
