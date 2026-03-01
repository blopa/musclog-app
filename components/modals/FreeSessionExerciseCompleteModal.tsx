import { LinearGradient } from 'expo-linear-gradient';
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

const SUCCESS_ICON_SIZE = 112; // size-28 in design (7rem)
const INNER_ICON_OFFSET = 8; // inset-2 => 8px
const CARD_IMAGE_SIZE = 80; // size-20

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

  const emerald = theme.colors.status.emerald;
  const indigo = theme.colors.status.indigo;
  const emerald20 = theme.colors.status.emerald20;
  const surfaceDark = theme.colors.background.overlay ?? theme.colors.background.card;
  const borderDark = theme.colors.border.dark;
  const textMuted = theme.colors.text.muted;

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('freeTraining.workoutName')}
      scrollable={false}
    >
      <View className="flex-1 px-6">
        <View className="flex-row items-center justify-between pb-4 pt-2">
          <View className="flex-1 items-center justify-center px-2">
            <Text
              className="text-[14px] font-bold uppercase tracking-widest"
              style={{ color: emerald }}
            >
              {t('freeTraining.inProgress')}
            </Text>
          </View>
          <View style={{ width: 40, height: 40 }} />
        </View>

        <View className="flex-1 items-center justify-center">
          {/* Success icon: gradient ring + inner gradient circle with check */}
          <View className="mb-8 items-center justify-center">
            <View
              className="absolute rounded-full"
              style={{
                width: SUCCESS_ICON_SIZE,
                height: SUCCESS_ICON_SIZE,
                borderWidth: 3,
                borderTopColor: emerald,
                borderRightColor: indigo,
                borderBottomColor: emerald20,
                borderLeftColor: emerald20,
                transform: [{ rotate: '45deg' }],
              }}
            />
            <View
              style={{
                width: SUCCESS_ICON_SIZE - INNER_ICON_OFFSET * 2,
                height: SUCCESS_ICON_SIZE - INNER_ICON_OFFSET * 2,
                borderRadius: 9999,
                overflow: 'hidden',
                shadowColor: emerald,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 4,
              }}
            >
              <LinearGradient
                colors={theme.colors.gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle size={48} color={theme.colors.text.white} strokeWidth={2.5} />
              </LinearGradient>
            </View>
          </View>

          <View className="mb-10 items-center gap-2">
            <Text
              className="text-center font-bold tracking-tight text-white"
              style={{ fontSize: theme.typography.fontSize['3xl'] }}
            >
              {t('freeTraining.exerciseComplete.title')}
            </Text>
            <Text
              className="text-center"
              style={{ color: textMuted, fontSize: theme.typography.fontSize.base }}
            >
              {t('freeTraining.exerciseComplete.subtitle')}
            </Text>
          </View>

          {/* Exercise summary card */}
          <View
            className="mb-8 w-full overflow-hidden rounded-2xl border p-5"
            style={{
              backgroundColor: surfaceDark,
              borderColor: borderDark,
              borderRadius: theme.borderRadius['2xl'],
            }}
          >
            <View className="flex-row items-start gap-4">
              <View
                className="shrink-0 items-center justify-center rounded-xl border"
                style={{
                  width: CARD_IMAGE_SIZE,
                  height: CARD_IMAGE_SIZE,
                  backgroundColor: theme.colors.background.white5,
                  borderColor: borderDark,
                }}
              >
                <Text
                  className="font-bold"
                  style={{
                    fontSize: theme.typography.fontSize['2xl'],
                    color: theme.colors.text.primary,
                  }}
                >
                  {(exerciseName || '?').charAt(0)}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text
                  className="truncate font-bold text-white"
                  numberOfLines={1}
                  style={{ fontSize: theme.typography.fontSize.xl }}
                >
                  {exerciseName}
                </Text>
                <View className="mb-3 mt-1 flex-row items-center">
                  <CheckCircle
                    size={theme.iconSize.sm}
                    color={emerald}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={{
                      color: textMuted,
                      fontSize: theme.typography.fontSize.sm,
                    }}
                  >
                    {t('freeTraining.exerciseComplete.setsCompleted', { count: setsCompleted })}
                  </Text>
                </View>
                <View className="mt-1 border-t pt-3" style={{ borderColor: borderDark }}>
                  <Text
                    className="mb-1 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: textMuted, fontSize: theme.typography.fontSize.xs }}
                  >
                    {t('freeTraining.exerciseComplete.totalVolume')}
                  </Text>
                  <Text
                    className="font-bold tracking-tight text-white"
                    style={{ fontSize: theme.typography.fontSize['2xl'] }}
                  >
                    {displayVolumeStr}{' '}
                    <Text
                      style={{
                        fontSize: theme.typography.fontSize.sm,
                        fontWeight: '500',
                        color: textMuted,
                      }}
                    >
                      {t(weightUnitKey)}
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Buttons */}
          <View className="w-full gap-3">
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
              style={{ minHeight: 56 }}
            />
            <Button
              label={t('freeTraining.exerciseComplete.finishWorkout')}
              icon={<Flag size={theme.iconSize.lg} color={textMuted} />}
              size="md"
              width="full"
              variant="outline"
              onPress={() => {
                onFinishWorkout();
              }}
              loading={isFinishing}
              disabled={isFinishing}
              style={{
                minHeight: 56,
                backgroundColor: 'transparent',
                borderColor: borderDark,
              }}
            />
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
