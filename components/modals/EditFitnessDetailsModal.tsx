import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FitnessGoal, Gender, LiftingExperience, WeightGoal } from '../../database/models';
import { EditFitnessDetailsBody } from '../EditFitnessDetailsBody';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';

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
  fatPercentage?: number;
  weightGoal: WeightGoal;
  fitnessGoal: FitnessGoal;
  activityLevel: number;
  gender: Gender;
  experience: LiftingExperience;
};

export function EditFitnessDetailsModal({
  visible,
  onClose,
  onSave,
  initialData,
}: EditFitnessDetailsModalProps) {
  const { t } = useTranslation();
  const [currentFormData, setCurrentFormData] = useState<Partial<FitnessDetails> | undefined>(
    undefined
  );

  const handleSave = ({
    units,
    weight,
    height,
    fatPercentage,
    weightGoal,
    fitnessGoal,
    activityLevel,
    gender,
    experience,
  }: FitnessDetails) => {
    onSave?.({
      units,
      weight,
      height,
      fatPercentage,
      weightGoal,
      fitnessGoal,
      activityLevel,
      gender,
      experience,
    });
    onClose();
  };

  const handleFloatingSave = () => {
    if (
      currentFormData &&
      currentFormData.units &&
      currentFormData.weight &&
      currentFormData.height &&
      currentFormData.gender &&
      currentFormData.weightGoal &&
      currentFormData.fitnessGoal &&
      currentFormData.activityLevel &&
      currentFormData.experience
    ) {
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
