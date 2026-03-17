import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from './GenericCard';

type SelectedExerciseCardProps = {
  exerciseName: string;
  exerciseCategory?: string;
  exerciseType?: string;
  onChange?: () => void;
};

// Helper function to get translation key for muscle group
const getMuscleGroupTranslationKey = (muscleGroup: string): string => {
  const normalized = muscleGroup?.toLowerCase() || '';

  // Map normalized values to translation keys
  if (normalized.includes('chest')) return 'workout.muscleGroups.chest';
  if (normalized.includes('back') || normalized.includes('lat'))
    return 'workout.muscleGroups.back';
  if (
    normalized.includes('leg') ||
    normalized.includes('quad') ||
    normalized.includes('hamstring') ||
    normalized.includes('calf') ||
    normalized.includes('glute')
  )
    return 'workout.muscleGroups.legs';
  if (
    normalized.includes('arm') ||
    normalized.includes('bicep') ||
    normalized.includes('tricep') ||
    normalized.includes('shoulder') ||
    normalized.includes('deltoid')
  )
    return 'workout.muscleGroups.arms';

  return 'workout.muscleGroups.other';
};

// Helper function to get translation key for exercise type
const getExerciseTypeTranslationKey = (exerciseType: string): string => {
  return `workout.exerciseTypes.${exerciseType}`;
};

/**
 * SelectedExerciseCard - Displays the currently selected exercise
 * with an option to change it.
 */
export function SelectedExerciseCard({
  exerciseName,
  exerciseCategory,
  exerciseType,
  onChange,
}: SelectedExerciseCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  // Translate muscle group and exercise type
  const translatedCategory = exerciseCategory
    ? t(getMuscleGroupTranslationKey(exerciseCategory))
    : '';
  const translatedType = exerciseType ? t(getExerciseTypeTranslationKey(exerciseType)) : '';
  const detailsText = [translatedCategory, translatedType].filter(Boolean).join(' • ');

  return (
    <GenericCard backgroundVariant="gradient" variant="default">
      <View className="flex-row items-center gap-4 p-4">
        {/* Icon Container */}
        <View
          className="h-12 w-12 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.colors.accent.primary20 }}
        >
          <MaterialIcons
            name="fitness-center"
            size={theme.iconSize['2xl']}
            color={theme.colors.accent.primary}
          />
        </View>

        {/* Exercise Info */}
        <View className="min-w-0 flex-1">
          <Text
            className="mb-0.5 font-extrabold uppercase tracking-widest"
            style={{
              fontSize: theme.typography.fontSize.xxs + 2, // 10px
              color: theme.colors.accent.primary,
            }}
          >
            Selected Exercise
          </Text>
          <Text
            className="font-bold leading-tight"
            numberOfLines={1}
            style={{
              fontSize: theme.typography.fontSize.lg,
              color: theme.colors.text.primary,
            }}
          >
            {exerciseName}
          </Text>
          {detailsText ? (
            <Text
              className="truncate"
              numberOfLines={1}
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.secondary,
              }}
            >
              {detailsText}
            </Text>
          ) : null}
        </View>

        {/* Change Button */}
        {onChange ? (
          <Pressable onPress={onChange} className="flex-col items-center justify-center gap-0.5">
            <MaterialIcons
              name="swap-horiz"
              size={theme.iconSize.lg}
              color={theme.colors.accent.primary}
            />
            <Text
              className="font-bold uppercase"
              style={{
                fontSize: theme.typography.fontSize.xxs + 1, // 9px
                color: theme.colors.accent.primary,
              }}
            >
              {t('common.change')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </GenericCard>
  );
}
