import { useTranslation } from 'react-i18next';
import { FullScreenModal } from './FullScreenModal';
import { EditFitnessDetailsBody } from './EditFitnessDetailsBody';

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
  eatingPhase: 'cut' | 'maintain' | 'bulk';
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

  return (
    <>
      <FullScreenModal visible={visible} onClose={onClose} title={t('editFitnessDetails.title')}>
        <EditFitnessDetailsBody onClose={onClose} onSave={onSave} initialData={initialData} />
      </FullScreenModal>
    </>
  );
}
