import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ContextFields } from '@/components/cycle/ContextFields';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { getLocalCalendarYear, localCalendarDayDate, localDayStartMs } from '@/utils/calendarDate';
import type { ContraceptionMethod, CycleContextDto, CycleLifeStage } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';

import { CenteredModal } from './CenteredModal';
import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';

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
  const { activeContext, setContext, removeContext } = useMenstrualCycle();
  const [lifeStage, setLifeStage] = useState<CycleLifeStage>('regular');
  const [contraception, setContraception] = useState<ContraceptionMethod>('none');
  const [from, setFrom] = useState<Date>(() => localCalendarDayDate(new Date()));
  const [isPickerVisible, setIsPickerVisible] = useState(false);
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
      setIsPickerVisible(false);
    });

    return () => cancelAnimationFrame(frame);
  }, [visible, editing, activeContext]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setContext({ effectiveFrom: localDayStartMs(from), lifeStage, contraception });
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
          onPress={() => setIsPickerVisible(true)}
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

      <DatePickerModal
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        selectedDate={from}
        onDateSelect={(date) => {
          setFrom(localCalendarDayDate(date));
          setIsPickerVisible(false);
        }}
        maxDate={localCalendarDayDate(new Date())}
        maxYear={getLocalCalendarYear(new Date())}
      />
    </CenteredModal>
  );
}
