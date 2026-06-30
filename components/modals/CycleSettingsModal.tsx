import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { type CycleSetupData, EditCycleSetupData } from '@/components/EditCycleSetupData';
import { Button } from '@/components/theme/Button';
import type MenstrualCycle from '@/database/models/MenstrualCycle';
import { handleError } from '@/utils/handleError';

import { FullScreenModal } from './FullScreenModal';

type CycleSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  cycle: MenstrualCycle;
};

export function CycleSettingsModal({ visible, onClose, cycle }: CycleSettingsModalProps) {
  const { t } = useTranslation();
  const [currentFormData, setCurrentFormData] = useState<Partial<CycleSetupData>>({});
  const [isSaving, setIsSaving] = useState(false);

  const initialData: CycleSetupData = {
    lastPeriodStartDate: cycle.lastPeriodStartDate ? new Date(cycle.lastPeriodStartDate) : null,
    cycleLength: cycle.avgCycleLength,
    periodDuration: cycle.avgPeriodDuration,
    birthControlType: cycle.birthControlType ?? 'none',
    syncGoal: cycle.syncGoal ?? 'performance',
    lifeStage: cycle.lifeStage ?? 'regular',
  };

  const handleClose = () => {
    setCurrentFormData({});
    onClose();
  };

  const handleSave = async () => {
    const data: CycleSetupData = { ...initialData, ...currentFormData };
    setIsSaving(true);
    try {
      await cycle.updateCycle({
        avgCycleLength: data.cycleLength,
        avgPeriodDuration: data.periodDuration,
        useHormonalBirthControl: data.birthControlType !== 'none',
        birthControlType: data.birthControlType !== 'none' ? data.birthControlType : null,
        syncGoal: data.syncGoal,
        lifeStage: data.lifeStage ?? null,
      });
      handleClose();
    } catch (error) {
      handleError(error, 'CycleSettingsModal.handleSave', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={handleClose}
      title={t('cycle.settings.title')}
      subtitle={t('cycle.settings.subtitle')}
      footer={
        <Button
          label={t('cycle.settings.save')}
          onPress={handleSave}
          variant="accent"
          size="md"
          width="full"
          loading={isSaving}
        />
      }
    >
      <View className="px-4 py-4">
        {/* key forces remount on each open so form resets to current cycle data */}
        <EditCycleSetupData
          key={visible ? cycle.updatedAt : 'closed'}
          initialData={initialData}
          onFormChange={setCurrentFormData}
          showDatePicker={false}
        />
      </View>
    </FullScreenModal>
  );
}
