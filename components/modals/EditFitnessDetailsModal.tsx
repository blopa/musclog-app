import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EditFitnessDetailsBody } from '@/components/EditFitnessDetailsBody';
import { Button } from '@/components/theme/Button';
import type { FitnessDetails } from '@/types/fitnessDetails';

import { FullScreenModal } from './FullScreenModal';

export type { FitnessDetails } from '../../types/fitnessDetails';

type EditFitnessDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (data: FitnessDetails) => void;
  initialData?: Partial<FitnessDetails>;
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

  const handleSave = (data: FitnessDetails) => {
    onSave?.(data);
    onClose();
  };

  const handleFloatingSave = () => {
    if (
      currentFormData &&
      currentFormData.units &&
      currentFormData.weight &&
      currentFormData.height &&
      currentFormData.gender &&
      currentFormData.weightGoal != null &&
      currentFormData.fitnessGoal &&
      currentFormData.activityLevel != null &&
      currentFormData.experience
    ) {
      handleSave(currentFormData as FitnessDetails);
    }
  };

  return (
    <FullScreenModal
      debugKey="EditFitnessDetailsModal"
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
