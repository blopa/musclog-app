import { Dumbbell, Share2, Weight } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import Exercise from '../../database/models/Exercise';
import WorkoutLog from '../../database/models/WorkoutLog';
import WorkoutLogSet from '../../database/models/WorkoutLogSet';
import WorkoutTemplate from '../../database/models/WorkoutTemplate';
import WorkoutTemplateSet from '../../database/models/WorkoutTemplateSet';
import { useSessionTotalTime } from '../../hooks/useSessionTotalTime';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { getWeightUnitI18nKey } from '../../utils/units';
import { Button } from '../theme/Button';
import { ExerciseData, ExerciseItem } from '../WorkoutHistoryExerciseItem';
import { FullScreenModal } from './FullScreenModal';

export type { SetData } from '../WorkoutHistorySetRow';

export type WorkoutHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  // When isPreview is false: workoutLog is required
  workoutLog?: WorkoutLog | null;
  // When isPreview is true: workoutTemplate is required
  workoutTemplate?: WorkoutTemplate | null;
  sets?: WorkoutLogSet[];
  templateSets?: WorkoutTemplateSet[];
  exercises?: Exercise[];
  currentSetOrder?: number | null;
  isPreview?: boolean;
  onStartWorkout?: () => void;
};

export function WorkoutSessionHistoryModal({
  visible,
  onClose,
  workoutLog,
  workoutTemplate,
  sets = [],
  templateSets = [],
  exercises = [],
  currentSetOrder = null,
  isPreview = false,
  onStartWorkout,
}: WorkoutHistoryModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);

  const sessionTime = useSessionTotalTime({ startTime: workoutLog?.startedAt });

  // Determine workout name based on mode
  const workoutName = useMemo(() => {
    if (isPreview && workoutTemplate) {
      return workoutTemplate.name || 'Workout';
    }
    return workoutLog?.workoutName || 'Workout';
  }, [isPreview, workoutTemplate, workoutLog]);

  // Transform workout data into ExerciseData format
  const exerciseDataList = useMemo(() => {
    if (isPreview) {
      // Preview mode: use template sets
      if (!workoutTemplate || templateSets.length === 0 || exercises.length === 0) {
        return [];
      }

      // Group template sets by exercise
      const exerciseMap = new Map<string, Exercise>();
      exercises.forEach((ex) => exerciseMap.set(ex.id, ex));

      const exerciseGroups = new Map<string, WorkoutTemplateSet[]>();
      templateSets.forEach((set) => {
        const exerciseId = set.exerciseId ?? '';
        if (!exerciseGroups.has(exerciseId)) {
          exerciseGroups.set(exerciseId, []);
        }
        exerciseGroups.get(exerciseId)!.push(set);
      });

      // Sort sets within each exercise by set_order
      exerciseGroups.forEach((exerciseSets) => {
        exerciseSets.sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0));
      });

      // Create exercise data list
      const exerciseOrder = Array.from(exerciseGroups.keys());
      const result: ExerciseData[] = [];

      exerciseOrder.forEach((exerciseId, index) => {
        const exercise = exerciseMap.get(exerciseId);
        if (!exercise) return;

        const exerciseSets = exerciseGroups.get(exerciseId) || [];

        // No time in preview mode
        const exerciseTime = '';

        // Transform template sets to SetData format
        const transformedSets = exerciseSets.map((set, setIndex) => {
          return {
            setNumber: setIndex + 1,
            weight: set.targetWeight ?? 0,
            reps: set.targetReps ?? 0,
            partials: 0, // Templates don't have partials
            isCurrent: false, // No current set in preview
          };
        });

        // No progress in preview mode (all sets are 0%)
        const setProgress = exerciseSets.map(() => 0);

        result.push({
          id: exerciseId,
          name: exercise.name ?? '',
          time: exerciseTime,
          exerciseNumber: index + 1,
          sets: transformedSets,
          setProgress,
        });
      });

      return result;
    } else {
      // Session mode: use workout log sets
      if (!workoutLog || sets.length === 0 || exercises.length === 0) {
        return [];
      }

      // Group sets by exercise
      const exerciseMap = new Map<string, Exercise>();
      exercises.forEach((ex) => exerciseMap.set(ex.id, ex));

      const exerciseGroups = new Map<string, WorkoutLogSet[]>();
      sets.forEach((set) => {
        const exerciseId = set.exerciseId ?? '';
        if (!exerciseGroups.has(exerciseId)) {
          exerciseGroups.set(exerciseId, []);
        }
        exerciseGroups.get(exerciseId)!.push(set);
      });

      // Sort sets within each exercise by set_order
      exerciseGroups.forEach((exerciseSets) => {
        exerciseSets.sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0));
      });

      // Create exercise data list
      const exerciseOrder = Array.from(exerciseGroups.keys());
      const result: ExerciseData[] = [];

      exerciseOrder.forEach((exerciseId, index) => {
        const exercise = exerciseMap.get(exerciseId);
        if (!exercise) return;

        const exerciseSets = exerciseGroups.get(exerciseId) || [];

        // Find the first set's time (use startedAt for first exercise, estimate for others)
        let exerciseTime = '';
        if (index === 0 && workoutLog.startedAt) {
          const date = new Date(workoutLog.startedAt);
          const hours = date.getHours();
          const minutes = date.getMinutes();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          exerciseTime = `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
        } else {
          // Estimate time for subsequent exercises (could be improved with actual timestamps)
          exerciseTime = '';
        }

        // Transform sets
        const transformedSets = exerciseSets.map((set, setIndex) => {
          const isCurrent = (set.setOrder ?? 0) === currentSetOrder;
          return {
            setNumber: setIndex + 1,
            weight: set.weight ?? 0,
            reps: set.reps ?? 0,
            partials: set.partials || 0,
            isCurrent,
          };
        });

        // Calculate set progress (100% if completed, 0% if not started, partial if current)
        const setProgress = exerciseSets.map((set) => {
          if ((set.difficultyLevel ?? 0) > 0) {
            return 100; // Completed
          } else if (set.setOrder === currentSetOrder) {
            return 50; // Current set (in progress)
          } else {
            return 0; // Not started
          }
        });

        result.push({
          id: exerciseId,
          name: exercise.name ?? '',
          time: exerciseTime,
          exerciseNumber: index + 1,
          sets: transformedSets,
          setProgress,
        });
      });

      return result;
    }
  }, [isPreview, workoutTemplate, workoutLog, templateSets, sets, exercises, currentSetOrder]);

  // Calculate total volume
  const totalVolume = useMemo(() => {
    if (isPreview) {
      // Preview mode: calculate planned volume from template sets
      return templateSets.reduce((sum, set) => {
        return sum + (set.targetReps ?? 0) * (set.targetWeight ?? 0);
      }, 0);
    } else {
      // Session mode: only count completed sets
      return sets.reduce((sum, set) => {
        if ((set.difficultyLevel ?? 0) > 0) {
          return sum + (set.reps ?? 0) * (set.weight ?? 0);
        }
        return sum;
      }, 0);
    }
  }, [isPreview, templateSets, sets]);

  // Count completed sets (only for session mode)
  const completedSetsCount = useMemo(() => {
    if (isPreview) {
      return 0; // No completed sets in preview
    }
    return sets.filter((set) => (set.difficultyLevel ?? 0) > 0).length;
  }, [isPreview, sets]);

  // Prepare footer content for preview mode
  const footerContent = useMemo(() => {
    if (isPreview && onStartWorkout) {
      return (
        <Button
          label={t('workoutHistory.startThisWorkout')}
          variant="accent"
          size="md"
          width="full"
          onPress={onStartWorkout}
        />
      );
    }
    return null;
  }, [isPreview, onStartWorkout, t]);

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={isPreview ? t('workoutHistory.previewTitle') : t('workoutHistory.title')}
      headerRight={
        <Pressable className="rounded-full p-2">
          <Share2 size={theme.iconSize.md} color={theme.colors.text.secondary} />
        </Pressable>
      }
      footer={footerContent}
    >
      <View className="gap-6 px-4 pb-8 pt-4">
        {/* Workout Summary */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text
                className="mb-0.5 block text-sm font-bold uppercase tracking-wider"
                style={{ color: theme.colors.accent.primary }}
              >
                {isPreview
                  ? t('workoutHistory.previewSubtitle')
                  : t('workoutHistory.workoutInProgress')}
              </Text>
              <Text className="text-3xl font-bold leading-tight text-text-primary">
                {workoutName}
              </Text>
            </View>
            {!isPreview ? (
              <View className="items-end">
                <Text className="font-mono text-3xl font-bold tabular-nums tracking-tight text-text-primary">
                  {`${String(sessionTime.hours).padStart(2, '0')}:${String(sessionTime.minutes).padStart(2, '0')}:${String(sessionTime.seconds).padStart(2, '0')}`}
                </Text>
                <Text className="text-sm font-medium text-text-secondary">
                  {t('workoutHistory.duration')}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Stats Pills */}
          <View className="mt-1 flex-row items-center gap-3">
            <View
              className="flex-row items-center gap-1.5 rounded-lg px-3 py-1.5"
              style={{ backgroundColor: theme.colors.status.info20 }}
            >
              <Weight size={theme.iconSize.md} color={theme.colors.status.info} />
              <Text className="text-sm font-semibold" style={{ color: theme.colors.status.info }}>
                {totalVolume.toLocaleString()} {t(weightUnitKey)} {t('workoutHistory.volume')}
              </Text>
            </View>
            {!isPreview ? (
              <View
                className="flex-row items-center gap-1.5 rounded-lg px-3 py-1.5"
                style={{ backgroundColor: theme.colors.background.white5 }}
              >
                <Dumbbell size={theme.iconSize.md} color={theme.colors.text.secondary} />
                <Text className="text-sm font-semibold text-text-secondary">
                  {completedSetsCount} {t('workoutHistory.setsDone')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Divider */}
        <View className="h-px" style={{ backgroundColor: theme.colors.border.light }} />

        {/* Exercises List */}
        <View className="flex-col gap-3">
          {exerciseDataList.length > 0 ? (
            exerciseDataList.map((exercise, index) => (
              <ExerciseItem
                key={exercise.id}
                exercise={exercise}
                isLast={index === exerciseDataList.length - 1}
                weightUnitKey={weightUnitKey}
                isPreview={isPreview}
              />
            ))
          ) : (
            <Text className="text-text-secondary">{t('workoutHistory.noExercisesYet')}</Text>
          )}
        </View>
        {/* Bottom spacing */}
        <View className="h-8" />
      </View>
    </FullScreenModal>
  );
}
