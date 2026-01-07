import React from 'react';
import { List, Settings, Square } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { BottomPopUpMenu } from './BottomPopUpMenu';

type WorkoutOptionsModalProps = {
  visible: boolean;
  onClose: () => void;
  onPreviewWorkout?: () => void;
  onWorkoutSettings?: () => void;
  onEndWorkout?: () => void;
};

export function WorkoutOptionsModal({
  visible,
  onClose,
  onPreviewWorkout,
  onWorkoutSettings,
  onEndWorkout,
}: WorkoutOptionsModalProps) {
  const { t } = useTranslation();

  const items = [
    {
      icon: List,
      iconColor: theme.colors.text.primary,
      iconBgColor: `${theme.colors.text.primary}20`,
      title: t('workoutOptions.previewWorkout'),
      description: t('workoutOptions.previewWorkoutDesc'),
      onPress: () => onPreviewWorkout?.(),
    },
    {
      icon: Settings,
      iconColor: theme.colors.text.primary,
      iconBgColor: `${theme.colors.text.primary}20`,
      title: t('workoutOptions.workoutSettings'),
      description: t('workoutOptions.workoutSettingsDesc'),
      onPress: () => onWorkoutSettings?.(),
    },
    {
      icon: Square,
      iconColor: theme.colors.status.error,
      iconBgColor: `${theme.colors.status.error}20`,
      title: t('workoutOptions.endWorkout'),
      description: t('workoutOptions.endWorkoutDesc'),
      titleColor: theme.colors.status.error,
      descriptionColor: theme.colors.status.warning,
      onPress: () => onEndWorkout?.(),
    },
  ];

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title={t('workoutOptions.title')}
      items={items}
    />
  );
}
