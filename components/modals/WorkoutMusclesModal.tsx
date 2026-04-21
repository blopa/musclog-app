import { Download, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { MenuButton } from '@/components/theme/MenuButton';
import { WorkoutMusclesDetails } from '@/components/WorkoutMusclesDetails';
import { useChartCapture } from '@/hooks/useChartCapture';
import { useTheme } from '@/hooks/useTheme';

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
  const theme = useTheme();
  const { captureRef, isCapturing, captureAndShare } = useChartCapture();

  const modalTitle = title ?? t('workoutDetail.musclesWorked');

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={modalTitle}
      scrollable={false}
      headerRight={
        !isCapturing ? (
          <MenuButton
            icon={Platform.OS === 'web' ? Download : Share2}
            size="sm"
            color={theme.colors.text.tertiary}
            onPress={() => captureAndShare(modalTitle)}
          />
        ) : null
      }
    >
      <WorkoutMusclesDetails muscleGroups={muscleGroups} captureRef={captureRef} />
    </FullScreenModal>
  );
}
