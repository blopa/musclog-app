import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/theme/Button';
import NewNumericalInput from '@/components/theme/NewNumericalInput';
import { useSettings } from '@/hooks/useSettings';
import { getWeightUnitI18nKey } from '@/utils/units';

import { CenteredModal } from './CenteredModal';

type EditSetDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { weight: number; reps: number; partials: number; repsInReserve: number }) => void;
  setLabel: string;
  initialWeight: number;
  initialReps: number;
  initialPartials: number;
  initialRepsInReserve: number;
  showRir?: boolean;
};

export function EditSetDetailsModal({
  visible,
  onClose,
  onSave,
  setLabel,
  initialWeight,
  initialReps,
  initialPartials,
  initialRepsInReserve,
  showRir = false,
}: EditSetDetailsModalProps) {
  const { t } = useTranslation();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const [partials, setPartials] = useState(initialPartials);
  const [repsInReserve, setRepsInReserve] = useState(initialRepsInReserve);

  // Reset values when modal opens
  useEffect(() => {
    if (visible) {
      setWeight(initialWeight);
      setReps(initialReps);
      setPartials(initialPartials);
      setRepsInReserve(showRir ? initialRepsInReserve : 0);
    }
  }, [visible, initialWeight, initialReps, initialPartials, initialRepsInReserve, showRir]);

  const handleSave = () => {
    onSave({ weight, reps, partials, repsInReserve: showRir ? repsInReserve : 0 });
    onClose();
  };

  return (
    <CenteredModal
      visible={visible}
      onClose={onClose}
      title={t('editSetDetails.title')}
      subtitle={t('editSetDetails.subtitle', { setLabel })}
      footer={
        <View className="flex-row items-stretch gap-3">
          <Button
            label={t('editSetDetails.cancel')}
            variant="outline"
            size="sm"
            width="flex-1"
            onPress={onClose}
          />
          <Button
            label={t('editSetDetails.saveChanges')}
            variant="accent"
            size="sm"
            width="flex-1"
            onPress={handleSave}
          />
        </View>
      }
    >
      <View className="gap-6">
        {/* Weight */}
        <NewNumericalInput
          label={`${t('workoutSession.weight')} (${t(weightUnitKey)})`}
          value={weight}
          onChange={setWeight}
          min={0}
          step={0.5}
        />

        {/* Reps */}
        <NewNumericalInput
          label={t('workoutSession.reps')}
          value={reps}
          onChange={setReps}
          min={0}
          step={1}
        />

        {/* Partial Reps */}
        <NewNumericalInput
          label={t('editSetDetails.partialReps')}
          value={partials}
          onChange={setPartials}
          min={0}
          step={1}
        />

        {/* Reps in Reserve */}
        {showRir ? (
          <NewNumericalInput
            label={t('editSetDetails.repsInReserve')}
            value={repsInReserve}
            onChange={setRepsInReserve}
            min={0}
            step={1}
          />
        ) : null}
      </View>
    </CenteredModal>
  );
}
