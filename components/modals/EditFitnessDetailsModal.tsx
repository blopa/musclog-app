import { useTranslation } from 'react-i18next';
import { FullScreenModal } from './FullScreenModal';
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

  return (
    <>
      <FullScreenModal visible={visible} onClose={onClose} title={t('editFitnessDetails.title')}>
        <EditFitnessDetailsBody onClose={onClose} onSave={handleSave} initialData={initialData} />
      </FullScreenModal>
    </>
  );
}
