import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type MenstrualCycle from '../../database/models/MenstrualCycle';
import { localDayStartMs } from '../../utils/calendarDate';
import { type CycleSetupData, EditCycleSetupData } from '../EditCycleSetupData';
import { Button } from '../theme/Button';
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
    lastPeriodStartDate: new Date(cycle.lastPeriodStartDate),
    cycleLength: cycle.avgCycleLength,
    periodDuration: cycle.avgPeriodDuration,
    birthControlType: cycle.birthControlType ?? 'none',
    syncGoal: cycle.syncGoal ?? 'performance',
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
        lastPeriodStartDate: localDayStartMs(data.lastPeriodStartDate),
        useHormonalBirthControl: data.birthControlType !== 'none',
        birthControlType: data.birthControlType !== 'none' ? data.birthControlType : null,
        avgCycleLength: data.cycleLength,
        avgPeriodDuration: data.periodDuration,
        syncGoal: data.syncGoal,
      });
      // useMenstrualCycle subscribes via WatermelonDB .observe(), so cycle.tsx
      // re-renders automatically with fresh data after this write.
      handleClose();
    } catch (error) {
      console.error('Error updating cycle settings:', error);
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
        />
      </View>
    </FullScreenModal>
  );
}
