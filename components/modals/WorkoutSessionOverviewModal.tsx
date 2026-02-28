import {
  CheckCircle,
  CheckSquare,
  ChevronRight,
  Clock,
  Dumbbell,
  Play,
  XCircle,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, Text, View } from 'react-native';

import { isWorkoutType } from '../../constants/workoutTypes';
import WorkoutLog from '../../database/models/WorkoutLog';
import WorkoutLogSet from '../../database/models/WorkoutLogSet';
import { useActiveWorkout } from '../../hooks/useActiveWorkout';
import { useTheme } from '../../hooks/useTheme';
import { BottomPopUpMenu, BottomPopUpMenuItem } from '../BottomPopUpMenu';
import { GenericCard } from '../cards/GenericCard';
import { Button } from '../theme/Button';
import { MenuButton } from '../theme/MenuButton';
import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';

type ExerciseStatus = 'completed' | 'in-progress' | 'pending' | 'skipped';

type ExerciseUIData = {
  id: string;
  name: string;
  imageUrl: string;
  status: ExerciseStatus;
  setsCompleted: number;
  totalSets: number;
};

function WorkoutInfo({
  workoutLog,
  exerciseCount,
  isLoading,
}: {
  workoutLog: WorkoutLog | null;
  exerciseCount: number;
  isLoading: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <GenericCard variant="card" size="default">
        <View className="p-6">
          <View className="mb-2 flex-row items-start justify-between">
            <View className="h-8 w-32 rounded bg-bg-secondary" />
            <View className="h-6 w-20 rounded-full bg-bg-secondary" />
          </View>
          <View className="flex-row items-center gap-4">
            <View className="h-5 w-24 rounded bg-bg-secondary" />
            <View className="h-5 w-24 rounded bg-bg-secondary" />
          </View>
        </View>
      </GenericCard>
    );
  }

  return (
    <GenericCard variant="card" size="default">
      <View className="p-6">
        <View className="mb-2 flex-row items-start justify-between">
          <Text className="text-3xl font-extrabold tracking-tight text-text-primary">
            {workoutLog?.workoutName || t('workout.workout')}
          </Text>
          <View className="rounded-full bg-accent-primary/10 px-3 py-1">
            <Text className="text-xs font-bold uppercase tracking-widest text-text-accent">
              In Progress
            </Text>
          </View>
        </View>

        <View className="flex-row flex-wrap items-center gap-3">
          {workoutLog?.type && isWorkoutType(workoutLog.type) ? (
            <View className="rounded-full bg-bg-secondary px-3 py-1">
              <Text className="text-xs font-medium text-text-secondary">
                {t(`workout.type.${workoutLog.type}`)}
              </Text>
            </View>
          ) : null}
          <View className="flex-row items-center gap-2">
            <Clock size={theme.iconSize.sm} color={theme.colors.text.secondary} />
            <Text className="text-sm font-medium text-text-secondary">
              {t('workout.inProgress')}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Dumbbell size={theme.iconSize.sm} color={theme.colors.text.secondary} />
            <Text className="text-sm font-medium text-text-secondary">
              {t('workout.exercises', { count: exerciseCount })}
            </Text>
          </View>
        </View>
      </View>
    </GenericCard>
  );
}

function ExerciseCard({
  name,
  imageUrl,
  status,
  setsCompleted,
  totalSets,
  onPress,
}: {
  name: string;
  imageUrl: string;
  status: ExerciseStatus;
  setsCompleted: number;
  totalSets: number;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const isCompleted = status === 'completed';
  const isSkipped = status === 'skipped';
  const isInProgress = status === 'in-progress';

  const titleClassName = useMemo(() => {
    if (isCompleted) {
      return 'text-text-primary';
    }
    if (isInProgress) {
      return 'text-text-primary';
    }
    if (isSkipped) {
      return 'text-text-muted';
    }
    return 'text-text-secondary';
  }, [isCompleted, isInProgress, isSkipped]);

  return (
    <GenericCard variant="card" size="default" isPressable onPress={onPress}>
      <View className="p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-4">
            <View
              className={`h-16 w-16 overflow-hidden rounded-lg border border-border-default bg-bg-secondary ${
                isSkipped ? 'opacity-60' : ''
              }`}
            >
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className={`text-lg font-bold leading-tight ${titleClassName}`}>{name}</Text>
                {isSkipped ? (
                  <View className="rounded bg-bg-secondary px-2 py-1">
                    <Text className="text-[10px] font-bold text-text-muted">
                      {t('workout.skipped')}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="mt-2 flex-row items-center gap-2">
                {Array.from({ length: totalSets }).map((_, i) => (
                  <View
                    key={i}
                    className={`h-1.5 w-6 rounded-full ${
                      isSkipped
                        ? 'border border-border-light'
                        : i < setsCompleted
                          ? 'bg-accent-primary'
                          : 'bg-bg-secondary'
                    }`}
                  />
                ))}
              </View>
            </View>
          </View>

          <View className="ml-2">
            {isCompleted ? (
              <CheckCircle size={theme.iconSize.lg} color={theme.colors.accent.primary} />
            ) : (
              <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.secondary} />
            )}
          </View>
        </View>
      </View>
    </GenericCard>
  );
}

function ExerciseList({
  exercises,
  onSelectExercise,
}: {
  exercises: ExerciseUIData[];
  onSelectExercise?: (exerciseId: string) => void;
}) {
  const { t } = useTranslation();
  const [selectedExercise, setSelectedExercise] = useState<ExerciseUIData | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleExercisePress = (exercise: ExerciseUIData) => {
    setSelectedExercise(exercise);
    setShowConfirmation(true);
  };

  const handleConfirmStart = () => {
    if (selectedExercise) {
      onSelectExercise?.(selectedExercise.id);
    }
    setShowConfirmation(false);
    setSelectedExercise(null);
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setSelectedExercise(null);
  };

  return (
    <>
      <View className="gap-3">
        <Text className="px-2 text-xs font-bold uppercase tracking-widest text-text-muted">
          {t('workout.workoutSequence')}
        </Text>
        <View className="gap-3">
          {exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              name={exercise.name}
              imageUrl={exercise.imageUrl}
              status={exercise.status}
              setsCompleted={exercise.setsCompleted}
              totalSets={exercise.totalSets}
              onPress={() => handleExercisePress(exercise)}
            />
          ))}
        </View>
      </View>

      <ConfirmationModal
        visible={showConfirmation}
        onClose={handleCancelConfirmation}
        onConfirm={handleConfirmStart}
        title={t('workout.startFromExercise.title')}
        message={
          selectedExercise
            ? t('workout.startFromExercise.message', { exerciseName: selectedExercise.name })
            : ''
        }
        confirmLabel={t('workout.startFromExercise.confirm')}
        cancelLabel={t('workout.startFromExercise.cancel')}
        variant="primary"
      />
    </>
  );
}

type WorkoutSessionOverviewModalProps = {
  visible: boolean;
  onClose: () => void;
  workoutLogId?: string;
  onStartWorkout?: () => void;
  onResumeSession?: () => void;
  onSelectExercise?: (exerciseId: string) => void;
  onCancelWorkout?: () => void;
  onFinishWorkout?: () => void;
};

export default function WorkoutSessionOverviewModal({
  visible,
  onClose,
  workoutLogId,
  onStartWorkout,
  onResumeSession,
  onSelectExercise,
  onCancelWorkout,
  onFinishWorkout,
}: WorkoutSessionOverviewModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Load real workout data
  const {
    workoutLog,
    sets,
    exercises: dbExercises,
    progress,
    isLoading,
    error,
  } = useActiveWorkout(workoutLogId);

  // Transform database models to UI format
  const exerciseData = useMemo(() => {
    if (!sets || !dbExercises || sets.length === 0) {
      return [];
    }

    // Group sets by exercise
    const exerciseGroups = new Map<string, WorkoutLogSet[]>();
    sets.forEach((set) => {
      const exerciseId = set.exerciseId ?? '';
      if (!exerciseGroups.has(exerciseId)) {
        exerciseGroups.set(exerciseId, []);
      }
      exerciseGroups.get(exerciseId)!.push(set);
    });

    // Transform to UI format
    const exerciseList: ExerciseUIData[] = [];
    exerciseGroups.forEach((exerciseSets, exerciseId) => {
      const exercise = dbExercises.find((ex) => ex.id === exerciseId);
      if (!exercise) {
        return;
      }

      const completedSets = exerciseSets.filter((set) => (set.difficultyLevel ?? 0) > 0).length;
      const skippedSets = exerciseSets.filter((set) => set.isSkipped).length;
      const totalSets = exerciseSets.length;

      let status: ExerciseStatus;
      if (skippedSets === totalSets) {
        status = 'skipped';
      } else if (completedSets === totalSets) {
        status = 'completed';
      } else if (completedSets > 0) {
        status = 'in-progress';
      } else {
        status = 'pending';
      }

      exerciseList.push({
        id: exercise.id,
        name: exercise.name ?? '',
        imageUrl: exercise.imageUrl || '',
        status,
        setsCompleted: completedSets,
        totalSets,
      });
    });

    // Sort by first appearance in workout (set_order)
    return exerciseList.sort((a, b) => {
      const aFirstSet = sets.find((set) => set.exerciseId === a.id);
      const bFirstSet = sets.find((set) => set.exerciseId === b.id);
      return (aFirstSet?.setOrder || 0) - (bFirstSet?.setOrder || 0);
    });
  }, [sets, dbExercises]);

  const menuItems: BottomPopUpMenuItem[] = [
    {
      icon: XCircle,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error8,
      title: t('workoutOptions.cancelWorkout'),
      description: t('workoutOptions.cancelWorkoutDesc'),
      onPress: () => {
        setIsMenuVisible(false);
        onCancelWorkout?.();
      },
    },
    {
      icon: CheckSquare,
      iconColor: theme.colors.status.success,
      iconBgColor: theme.colors.status.success20,
      title: t('workoutOptions.finishWorkout'),
      description: t('workoutOptions.finishWorkoutDesc'),
      onPress: () => {
        setIsMenuVisible(false);
        onFinishWorkout?.();
      },
    },
  ];

  // Determine if workout has started (has any completed sets)
  const hasStarted = progress.completedSets > 0;

  // Determine button text and action
  const getButtonProps = () => {
    if (!hasStarted) {
      return {
        label: t('workout.startWorkout'),
        onPress: onStartWorkout,
      };
    }
    return {
      label: t('workout.resumeSession'),
      onPress: onResumeSession,
    };
  };

  const buttonProps = getButtonProps();

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('workout.sessionOverview')}
      scrollable={false}
      headerRight={
        <MenuButton
          size="lg"
          color={theme.colors.text.primary}
          onPress={() => setIsMenuVisible(true)}
        />
      }
      withGradient
      footer={
        <Button
          label={buttonProps.label}
          icon={Play}
          size="md"
          width="full"
          variant="accent"
          onPress={buttonProps.onPress}
          disabled={isLoading}
        />
      }
    >
      <View className="flex-1 bg-bg-primary">
        <BottomPopUpMenu
          visible={isMenuVisible}
          onClose={() => setIsMenuVisible(false)}
          title={t('workoutOptions.title')}
          items={menuItems}
        />
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: theme.spacing.padding['5xl'] }}
        >
          <View style={{ height: theme.spacing.gap.lg }} />
          <View className="gap-4 px-4">
            <WorkoutInfo
              workoutLog={workoutLog}
              exerciseCount={exerciseData.length}
              isLoading={isLoading}
            />
            <ExerciseList exercises={exerciseData} onSelectExercise={onSelectExercise} />
          </View>
        </ScrollView>
      </View>
    </FullScreenModal>
  );
}
