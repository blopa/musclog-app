import { CheckCircle, Flag, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { Units } from '../../constants/settings';
import WorkoutLogSet from '../../database/models/WorkoutLogSet';
import { useTheme } from '../../hooks/useTheme';
import { kgToDisplay } from '../../utils/unitConversion';
import { getWeightUnitI18nKey } from '../../utils/units';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';

type FreeSessionExerciseCompleteModalProps = {
  visible: boolean;
  onClose: () => void;
  exerciseName: string;
  sets: WorkoutLogSet[];
  exerciseId: string;
  units: Units;
  onAddNextExercise: () => void;
  onFinishWorkout: () => void;
  /** True while finish workout is in progress (disables buttons, shows loading on finish). */
  isFinishing?: boolean;
};

export function FreeSessionExerciseCompleteModal({
  visible,
  onClose,
  exerciseName,
  sets,
  exerciseId,
  units,
  onAddNextExercise,
  onFinishWorkout,
  isFinishing = false,
}: FreeSessionExerciseCompleteModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const weightUnitKey = getWeightUnitI18nKey(units);

  const { setsCompleted, totalVolumeKg } = useMemo(() => {
    const exerciseSets = sets.filter((s) => s.exerciseId === exerciseId);
    const completed = exerciseSets.filter(
      (s) => (s.difficultyLevel ?? 0) > 0 || (s.isSkipped ?? false)
    ).length;
    const volume = exerciseSets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight ?? 0), 0);
    return { setsCompleted: completed, totalVolumeKg: volume };
  }, [sets, exerciseId]);

  const displayVolume = kgToDisplay(totalVolumeKg, units);
  const displayVolumeStr =
    displayVolume % 1 === 0
      ? displayVolume.toLocaleString('en-US')
      : displayVolume.toLocaleString('en-US', { maximumFractionDigits: 1 });

  return (
    <FullScreenModal visible={visible} onClose={onClose} title="" showHeader={false}>
      <View className="flex-1 px-6 pt-4">
        <View className="items-center">
          <View
            className="mb-4 h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.accent.primary20 }}
          >
            <CheckCircle size={theme.iconSize['3xl']} color={theme.colors.accent.primary} />
          </View>
          <Text
            className="mb-2 text-center text-3xl font-bold text-text-primary"
            style={{ fontSize: theme.typography.fontSize['3xl'] }}
          >
            {t('freeTraining.exerciseComplete.title')}
          </Text>
          <Text
            className="mb-8 text-center text-base text-text-secondary"
            style={{ fontSize: theme.typography.fontSize.base }}
          >
            {t('freeTraining.exerciseComplete.subtitle')}
          </Text>
        </View>

        {/* Exercise summary card */}
        <View
          className="mb-8 flex-row items-center gap-4 rounded-xl border border-border-default bg-bg-card p-4"
          style={{ borderColor: theme.colors.background.white5 }}
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-lg"
            style={{ backgroundColor: theme.colors.accent.primary20 }}
          >
            <Text
              className="font-bold text-accent-primary"
              style={{ fontSize: theme.typography.fontSize['2xl'] }}
            >
              {(exerciseName || '?').charAt(0)}
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text
              className="font-bold text-text-primary"
              numberOfLines={1}
              style={{ fontSize: theme.typography.fontSize.lg }}
            >
              {exerciseName}
            </Text>
            <View className="mt-1 flex-row items-center gap-2">
              <CheckCircle size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              <Text
                className="text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.sm }}
              >
                {t('freeTraining.exerciseComplete.setsCompleted', { count: setsCompleted })}
              </Text>
            </View>
            <Text
              className="mt-1 text-xs uppercase tracking-wider text-text-muted"
              style={{ fontSize: theme.typography.fontSize.xs }}
            >
              {t('freeTraining.exerciseComplete.totalVolume')}
            </Text>
            <Text
              className="font-bold text-text-primary"
              style={{ fontSize: theme.typography.fontSize.xl }}
            >
              {displayVolumeStr} {t(weightUnitKey)}
            </Text>
          </View>
        </View>

        <View className="gap-4">
          <Button
            label={t('freeTraining.exerciseComplete.addNextExercise')}
            icon={<Plus size={theme.iconSize.lg} color={theme.colors.text.white} />}
            size="md"
            width="full"
            variant="gradientCta"
            onPress={() => {
              onClose();
              onAddNextExercise();
            }}
            disabled={isFinishing}
          />
          <Button
            label={t('freeTraining.exerciseComplete.finishWorkout')}
            icon={<Flag size={theme.iconSize.lg} color={theme.colors.text.primary} />}
            size="md"
            width="full"
            variant="secondary"
            onPress={() => {
              // Don't call onClose() here; parent hides modal and clears state after completeWorkout.
              onFinishWorkout();
            }}
            loading={isFinishing}
            disabled={isFinishing}
          />
        </View>
      </View>
    </FullScreenModal>
  );
}
