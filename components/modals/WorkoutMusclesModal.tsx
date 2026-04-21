import { useTranslation } from 'react-i18next';

import { WorkoutMusclesDetails } from '@/components/WorkoutMusclesDetails';

import { FullScreenModal } from './FullScreenModal';

type WorkoutMusclesModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  muscleGroups: (string | null | undefined)[];
};

export function WorkoutMusclesModal({
  visible,
  onClose,
  title,
  muscleGroups,
}: WorkoutMusclesModalProps) {
  const { t } = useTranslation();

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={title ?? t('workoutDetail.musclesWorked')}
      scrollable={false}
    >
      <WorkoutMusclesDetails muscleGroups={muscleGroups} />
    </FullScreenModal>
  );
}
