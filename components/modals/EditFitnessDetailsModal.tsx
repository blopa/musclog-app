import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { FullScreenModal } from './FullScreenModal';
import { Button } from '../theme/Button';
import { EditFitnessDetailsBody } from '../EditFitnessDetailsBody';

type EditFitnessDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (data: FitnessDetails) => void;
  initialData?: Partial<FitnessDetails>;
};

export type FitnessDetails = {
  units: 'imperial' | 'metric';
  weight: string;
  height: string;
  fitnessGoal: string;
  activityLevel: number;
  experience: 'beginner' | 'intermediate' | 'advanced';
};

export function EditFitnessDetailsModal({
  visible,
  onClose,
  onSave,
  initialData,
}: EditFitnessDetailsModalProps) {
  const { t } = useTranslation();
  const [currentFormData, setCurrentFormData] = useState<Partial<FitnessDetails> | undefined>(undefined);

  const handleSave = ({
    units,
    weight,
    height,
    fitnessGoal,
    activityLevel,
    experience,
  }: FitnessDetails) => {
    onSave?.({
      units,
      weight,
      height,
      fitnessGoal,
      activityLevel,
      experience,
    });
    onClose();
  };

  const handleFloatingSave = () => {
    if (currentFormData && 
        currentFormData.units && 
        currentFormData.weight && 
        currentFormData.height && 
        currentFormData.fitnessGoal && 
        currentFormData.activityLevel && 
        currentFormData.experience) {
      handleSave(currentFormData as FitnessDetails);
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('editFitnessDetails.title')}
      footer={
        <Button
          label={t('editFitnessDetails.saveChanges')}
          icon={Check}
          variant="gradientCta"
          size="md"
          width="full"
          onPress={handleFloatingSave}
        />
      }
    >
      <EditFitnessDetailsBody
        onClose={onClose}
        onSave={handleSave}
        onFormChange={setCurrentFormData}
        initialData={initialData}
        hideSaveButton
      />
    </FullScreenModal>
  );
}
