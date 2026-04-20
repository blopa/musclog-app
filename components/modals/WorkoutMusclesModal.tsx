import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import BodyHighlighter from '@/components/BodyHighlighter';

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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="p-4">
          <BodyHighlighter muscleGroups={muscleGroups} />
        </View>
      </ScrollView>
    </FullScreenModal>
  );
}
