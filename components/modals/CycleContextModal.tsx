import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ContextFields } from '@/components/cycle/ContextFields';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSubModalState } from '@/hooks/useSubModalVisibility';
import { getLocalCalendarYear, localCalendarDayDate, localDayStartMs } from '@/utils/calendarDate';
import { addCalendarDays } from '@/utils/cycle/dates';
import type { ContraceptionMethod, CycleContextDto, CycleLifeStage } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';

import { CenteredModal } from './CenteredModal';
import { ConfirmationModal } from './ConfirmationModal';
import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';

/** How long the quiet period offered after recording a loss lasts. */
export const LOSS_QUIET_DAYS = 28;

type CycleContextModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Editing an existing change; omitted to record a new one starting today. */
  context?: CycleContextDto | null;
};

/**
 * Records a change in life stage or contraception from a date on. Changes are appended, so the
 * history stays intact and the cycles from before a change keep being judged by what applied
 * then.
 */
export function CycleContextModal({ visible, onClose, context }: CycleContextModalProps) {
  const { t } = useTranslation();
  const { activeContext, setContext, removeContext, updateConfig } = useMenstrualCycle();
  const [lifeStage, setLifeStage] = useState<CycleLifeStage>('regular');
  const [contraception, setContraception] = useState<ContraceptionMethod>('none');
  const [from, setFrom] = useState<Date>(() => localCalendarDayDate(new Date()));
  // One sub-surface at a time: the date picker, or the quiet-period offer after a loss.
  const [sub, setSub] = useSubModalState<'date' | 'lossQuiet' | null>(visible, null);
  const [isSaving, setIsSaving] = useState(false);
  const editing = context ?? null;

  useEffect(() => {
    if (!visible) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const base = editing ?? activeContext;
      setLifeStage(base?.lifeStage ?? 'regular');
      setContraception(base?.contraception ?? 'none');
      setFrom(localCalendarDayDate(new Date(editing?.effectiveFrom ?? Date.now())));
    });

    return () => cancelAnimationFrame(frame);
  }, [visible, editing, activeContext]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setContext({ effectiveFrom: localDayStartMs(from), lifeStage, contraception });
      // Recording a loss already stops every prediction and period reminder (the context
      // suppresses them on the reschedule that follows this write). What is left — the daily
      // check-in and other routines — is offered a quiet period rather than silenced by default.
      if (lifeStage === 'pregnancy_loss' && activeContext?.lifeStage !== 'pregnancy_loss') {
        setSub('lossQuiet');
        return;
      }

      onClose();
    } catch (error) {
      handleError(error, 'CycleContextModal.save', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!editing) {
      return;
    }

    try {
      await removeContext(editing.id);
      onClose();
    } catch (error) {
      handleError(error, 'CycleContextModal.remove', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    }
  };

  return (
    <CenteredModal
      visible={visible}
      onClose={onClose}
      title={t('cycle.context.title')}
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
        <Text className="text-sm text-text-secondary">{t('cycle.context.description')}</Text>
        <DatePickerInput
          label={t('cycle.context.effectiveFrom')}
          selectedDate={from}
          onPress={() => setSub('date')}
        />
        <ContextFields
          lifeStage={lifeStage}
          contraception={contraception}
          onLifeStageChange={setLifeStage}
          onContraceptionChange={setContraception}
        />
        {contraception === 'iud_unspecified' || contraception === 'pill_unspecified' ? (
          <Text className="text-xs text-text-tertiary">{t('cycle.context.chooseSpecific')}</Text>
        ) : null}
        <Text className="text-xs text-text-tertiary">{t('cycle.context.effects')}</Text>
        {editing ? (
          <TextButton
            label={t('cycle.context.remove')}
            tone="danger"
            onPress={() => void handleRemove()}
          />
        ) : null}
      </View>

      {sub === 'lossQuiet' ? (
        <ConfirmationModal
          visible
          onClose={() => {
            setSub(null);
            onClose();
          }}
          onConfirm={async () => {
            try {
              await updateConfig({
                reminders: { pause: { until: addCalendarDays(Date.now(), LOSS_QUIET_DAYS) } },
              });
            } catch (error) {
              handleError(error, 'CycleContextModal.lossQuiet', {
                snackbarMessage: t('errors.somethingWentWrong'),
              });
            }

            setSub(null);
            onClose();
          }}
          title={t('cycle.context.lossQuietTitle')}
          message={t('cycle.context.lossQuietMessage')}
          confirmLabel={t('cycle.context.lossQuietConfirm')}
          cancelLabel={t('cycle.context.lossQuietKeep')}
          variant="primary"
        />
      ) : (
        <DatePickerModal
          visible={sub === 'date'}
          onClose={() => setSub(null)}
          selectedDate={from}
          onDateSelect={(date) => {
            setFrom(localCalendarDayDate(date));
            setSub(null);
          }}
          maxDate={localCalendarDayDate(new Date())}
          maxYear={getLocalCalendarYear(new Date())}
        />
      )}
    </CenteredModal>
  );
}
