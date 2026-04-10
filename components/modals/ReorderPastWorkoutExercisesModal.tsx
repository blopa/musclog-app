import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { OptionsMultiSelector } from '@/components/theme/OptionsMultiSelector/OptionsMultiSelector';
import type { SelectorOption } from '@/components/theme/OptionsMultiSelector/utils';
import Exercise from '@/database/models/Exercise';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import { WorkoutService } from '@/database/services';
import { useTheme } from '@/hooks/useTheme';
import { getWorkoutIcon } from '@/utils/workoutHistory';

import { FullScreenModal } from './FullScreenModal';

type ReorderPastWorkoutExercisesModalProps = {
  visible: boolean;
  onClose: () => void;
  workoutLogId: string;
  logExercises: WorkoutLogExercise[];
  exercises: Exercise[];
  onSave?: () => Promise<void> | void;
};

export function ReorderPastWorkoutExercisesModal({
  visible,
  onClose,
  workoutLogId,
  logExercises,
  exercises,
  onSave,
}: ReorderPastWorkoutExercisesModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);

  const [currentOptions, setCurrentOptions] = useState<SelectorOption<string>[]>([]);

  useEffect(() => {
    if (visible) {
      const exerciseMap = new Map<string, Exercise>();
      exercises.forEach((ex) => exerciseMap.set(ex.id, ex));

      const options: SelectorOption<string>[] = logExercises.map((le) => {
        const exercise = exerciseMap.get(le.exerciseId);
        const iconData = getWorkoutIcon(theme, exercise?.name ?? '');

        return {
          id: le.id,
          label: exercise?.name ?? '',
          description: '',
          icon: iconData.icon,
          iconColor: iconData.iconBgColor,
          iconBgColor: iconData.iconBgOpacity,
          groupId: le.groupId,
        };
      });
      setCurrentOptions(options);
    }
  }, [visible, logExercises, exercises, theme]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const reorderedData = currentOptions.map((opt) => ({
        id: opt.id as string,
        groupId: opt.groupId,
      }));

      await WorkoutService.reorderWorkoutLogExercises(workoutLogId, reorderedData);
      await onSave?.();
      onClose();
    } catch (error) {
      console.error('Error saving reordered exercises:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const headerRight = (
    <Pressable
      onPress={handleSave}
      className="flex-row items-center gap-2 px-3 py-1"
      disabled={isSaving}
    >
      {isSaving ? <ActivityIndicator size="small" color={theme.colors.accent.primary} /> : null}
      <Text
        style={{ color: isSaving ? theme.colors.text.tertiary : theme.colors.accent.primary }}
        className="font-bold"
      >
        {isSaving ? t('common.saving') : t('common.save')}
      </Text>
    </Pressable>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('workoutDetail.reorderTitle')}
      headerRight={headerRight}
    >
      <View className="p-4">
        <OptionsMultiSelector
          title={t('workoutDetail.exercisesCount', { count: currentOptions.length })}
          options={currentOptions}
          onChange={() => {}}
          onOrderChange={setCurrentOptions}
          isEditable={true}
          hasGroups={true}
        />
      </View>
    </FullScreenModal>
  );
}
