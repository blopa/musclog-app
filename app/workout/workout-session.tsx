import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SkipForward, Edit, Repeat, CheckCircle, WifiOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { useSettings } from '../../hooks/useSettings';
import { getWeightUnitI18nKey } from '../../utils/units';
import { WorkoutOptionsModal } from '../../components/modals/WorkoutOptionsModal';
import { EndWorkoutModal } from '../../components/modals/EndWorkoutModal';
import { WorkoutTimeTracker } from '../../components/WorkoutTimeTracker';
import { WorkoutStatCard } from '../../components/cards/WorkoutStatCard';
import { WorkoutActionButton } from '../../components/WorkoutActionButton';
import { LogSetPerformanceModal } from '../../components/modals/LogSetPerformanceModal';
import { EditSetDetailsModal } from '../../components/modals/EditSetDetailsModal';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { ReplaceExerciseModal, Exercise } from '../../components/modals/ReplaceExerciseModal';
import { WorkoutSessionHistoryModal } from '../../components/modals/WorkoutSessionHistoryModal';
import { SessionFeedbackModal } from '../../components/modals/SessionFeedbackModal';
import { Button } from '../../components/theme/Button';
import { useActiveWorkout } from '../../hooks/useActiveWorkout';
import { WorkoutService } from '../../database/services/WorkoutService';
import { database } from '../../database';
import WorkoutLog from '../../database/models/WorkoutLog';
import WorkoutLogSet from '../../database/models/WorkoutLogSet';
import { Q } from '@nozbe/watermelondb';
import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { clearActiveWorkoutLogId } from '../../utils/activeWorkoutStorage';

export default function WorkoutSessionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutLogId?: string }>();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);

  const workoutLogId = params.workoutLogId;
  const { workoutLog, sets, exercises, currentSetData, progress, isLoading, error, isWorkoutComplete, refresh } =
    useActiveWorkout(workoutLogId);

  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [partials, setPartials] = useState(0);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isEndWorkoutModalVisible, setIsEndWorkoutModalVisible] = useState(false);
  const [isLogSetModalVisible, setIsLogSetModalVisible] = useState(false);
  const [isEditSetModalVisible, setIsEditSetModalVisible] = useState(false);
  const [isSkipSetModalVisible, setIsSkipSetModalVisible] = useState(false);
  const [isReplaceExerciseModalVisible, setIsReplaceExerciseModalVisible] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [isSessionFeedbackModalVisible, setIsSessionFeedbackModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Update weight/reps when current set changes
  useEffect(() => {
    if (currentSetData) {
      setWeight(currentSetData.set.weight);
      setReps(currentSetData.set.reps);
      setPartials(currentSetData.set.partials || 0);
    }
  }, [currentSetData]);

  // Redirect if no active workout
  useEffect(() => {
    if (!isLoading && !workoutLog && !workoutLogId) {
      router.replace('/workout/workouts');
    }
  }, [isLoading, workoutLog, workoutLogId, router]);

  // Redirect if workout is complete
  useEffect(() => {
    if (!isLoading && isWorkoutComplete() && workoutLog) {
      router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
    }
  }, [isLoading, isWorkoutComplete, workoutLog, router]);

  const handleCompleteSet = async (rpe: number) => {
    if (!currentSetData || !workoutLog) return;

    try {
      setIsSaving(true);
      
      // Store rest time BEFORE updating the set (since currentSetData will change after update)
      const restTime = currentSetData.set.restTimeAfter || 0;
      const completedSetOrder = currentSetData.set.setOrder;

      await workoutLog.updateSet(currentSetData.set.id, {
        difficultyLevel: rpe,
        weight,
        reps,
        partials,
      });

      // Refresh to get updated data
      await refresh();

      // Check if workout is complete
      if (isWorkoutComplete()) {
        setIsLogSetModalVisible(false);
        router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
        return;
      }

      // Check if there's a next set
      const nextSet = await WorkoutService.getNextSet(workoutLog.id, completedSetOrder);
      if (!nextSet) {
        // No next set, workout is complete
        setIsLogSetModalVisible(false);
        router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
        return;
      }

      // Navigate to rest timer
      setIsLogSetModalVisible(false);
      if (restTime > 0) {
        router.push(
          `/workout/rest-timer?workoutLogId=${workoutLog.id}&completedSetOrder=${completedSetOrder}`
        );
      } else {
        // No rest time, go directly to next set
        router.replace(`/workout/workout-session?workoutLogId=${workoutLog.id}`);
      }
    } catch (err) {
      console.error('Error completing set:', err);
      // Show error to user
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipSet = async () => {
    if (!currentSetData || !workoutLog) return;

    try {
      setIsSaving(true);
      // Mark set as skipped (set difficultyLevel to 0, but we'll track it differently)
      // For now, we'll just move to next set without saving RPE
      await refresh();

      // Navigate to next set
      const nextSet = await WorkoutService.getNextSet(workoutLog.id, currentSetData.set.setOrder);
      if (!nextSet) {
        router.replace(`/workout/workout-summary?workoutLogId=${workoutLog.id}`);
      } else {
        router.replace(`/workout/workout-session?workoutLogId=${workoutLog.id}`);
      }
    } catch (err) {
      console.error('Error skipping set:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSet = async (data: { weight: number; reps: number; partials: number }) => {
    if (!currentSetData || !workoutLog) return;

    try {
      setIsSaving(true);
      await workoutLog.updateSet(currentSetData.set.id, {
        weight: data.weight,
        reps: data.reps,
        partials: data.partials,
      });

      setWeight(data.weight);
      setReps(data.reps);
      setPartials(data.partials);
      await refresh();
    } catch (err) {
      console.error('Error updating set:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReplaceExercise = async (exercise: Exercise) => {
    if (!currentSetData || !workoutLog) return;

    try {
      setIsSaving(true);
      // Update all remaining sets of the same exercise
      const exerciseSets = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(
          Q.where('workout_log_id', workoutLog.id),
          Q.where('exercise_id', currentSetData.set.exerciseId),
          Q.where('set_order', Q.gte(currentSetData.set.setOrder))
        )
        .fetch();

      // Update all sets to use new exercise
      await database.write(async () => {
        for (const set of exerciseSets) {
          await set.update((s) => {
            s.exerciseId = exercise.id;
          });
        }
      });

      await refresh();
    } catch (err) {
      console.error('Error replacing exercise:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishWorkout = async () => {
    if (!workoutLog) return;

    try {
      setIsSaving(true);
      await WorkoutService.completeWorkout(workoutLog.id);
      setIsEndWorkoutModalVisible(false);
      setIsSessionFeedbackModalVisible(true);
    } catch (err) {
      console.error('Error completing workout:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Get exercise image - use default if not available
  const getExerciseImage = () => {
    if (currentSetData?.exercise.imageUrl) {
      // For now, use default image. In production, you'd load from imageUrl
      return require('../../assets/icon.png');
    }
    return require('../../assets/icon.png');
  };

  // Get exercise category string
  const getExerciseCategory = () => {
    if (!currentSetData) return '';
    const exercise = currentSetData.exercise;
    const parts = [];
    if (exercise.muscleGroup) parts.push(exercise.muscleGroup);
    if (exercise.equipmentType) parts.push(exercise.equipmentType);
    return parts.join(' • ') || 'Exercise';
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !currentSetData || !workoutLog) {
    return (
      <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center px-6">
          <ErrorStateCard
            icon={WifiOff}
            title={error || 'Workout not found'}
            description="Unable to load workout session. Please try again."
            buttonLabel="Go Back"
            onButtonPress={() => router.replace('/workout/workouts')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const exerciseImage = getExerciseImage();
  const exerciseCategory = getExerciseCategory();
  const previousSet = currentSetData.previousSet;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View className="flex-1">
        {/* Hero Image Background */}
        <ImageBackground
          source={exerciseImage}
          className="absolute inset-0"
          style={{ height: theme.size['3xl'] * 10 }}
          resizeMode="cover"
        >
          <LinearGradient
            colors={[
              ...theme.colors.gradients.workoutSessionOverlay,
              theme.colors.background.primary,
            ]}
            locations={[0, 0.2, 0.5, 1]}
            style={{ flex: 1 }}
          />
        </ImageBackground>

        {/* Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <WorkoutTimeTracker
            onClose={() => setIsEndWorkoutModalVisible(true)}
            onOptionsPress={() => setIsOptionsModalVisible(true)}
            startTime={workoutLog.startedAt}
          />

          {/* Exercise Info */}
          <View className="mt-48 px-6">
            <Text className="mb-3 text-5xl font-bold text-text-primary">
              {currentSetData.exercise.name}
            </Text>
            <View className="mb-2 flex-row items-center gap-3">
              <View className="rounded-full bg-accent-primary px-4 py-1.5">
                <Text className="text-sm font-bold text-text-black">
                  {t('workoutSession.setOf', {
                    current: currentSetData.setNumber,
                    total: currentSetData.totalSetsInExercise,
                  })}
                </Text>
              </View>
              <Text className="text-lg text-text-secondary">{exerciseCategory}</Text>
            </View>
          </View>

          {/* Stats Cards */}
          <View className="mt-8 flex-row gap-3 px-6">
            <WorkoutStatCard
              title={t('workoutSession.weight')}
              value={weight}
              unit={t(weightUnitKey)}
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
            />
            <WorkoutStatCard
              title={t('workoutSession.reps')}
              value={reps}
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
            />
            <WorkoutStatCard
              title={t('workoutSession.partials')}
              value={partials === 0 ? '-' : partials}
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
            />
          </View>

          {/* Previous & History */}
          <View className="mt-6 flex-row items-center justify-between px-6">
            {previousSet ? (
              <Text className="text-text-secondary">
                {t('workoutSession.previous')}:{' '}
                <Text className="text-text-primary">
                  {previousSet.weight} {t(weightUnitKey)} × {previousSet.reps}{' '}
                  {t('workoutSession.reps')}
                </Text>
              </Text>
            ) : (
              <Text className="text-text-secondary">{t('workoutSession.previous')}: -</Text>
            )}
            <Pressable onPress={() => setIsHistoryModalVisible(true)}>
              <Text className="font-semibold text-accent-primary">
                {t('workoutSession.history')}
              </Text>
            </Pressable>
          </View>

          {/* Action Buttons */}
          <View className="mt-8 px-6 pb-32">
            <View className="mb-6 flex-row gap-6">
              <WorkoutActionButton
                icon={SkipForward}
                label={t('workoutSession.skip')}
                onPress={() => {
                  setIsSkipSetModalVisible(true);
                }}
              />
              <WorkoutActionButton
                icon={Edit}
                label={t('workoutSession.edit')}
                onPress={() => {
                  setIsEditSetModalVisible(true);
                }}
              />
              <WorkoutActionButton
                icon={Repeat}
                label={t('workoutSession.replace')}
                onPress={() => {
                  setIsReplaceExerciseModalVisible(true);
                }}
              />
            </View>

            {/* Complete Button */}
            <Button
              label={t('workoutSession.completeSet')}
              icon={CheckCircle}
              size="md"
              width="full"
              onPress={() => {
                setIsLogSetModalVisible(true);
              }}
              disabled={isSaving}
            />
          </View>
        </ScrollView>
      </View>

      {/* Workout Options Modal */}
      <WorkoutOptionsModal
        visible={isOptionsModalVisible}
        onClose={() => setIsOptionsModalVisible(false)}
        onPreviewWorkout={() => router.push('/workout-preview')}
        onWorkoutSettings={() => router.push('/workout-settings')}
        onEndWorkout={() => {
          setIsOptionsModalVisible(false);
          setIsEndWorkoutModalVisible(true);
        }}
      />

      {/* End Workout Confirmation Modal */}
      <EndWorkoutModal
        visible={isEndWorkoutModalVisible}
        onClose={() => setIsEndWorkoutModalVisible(false)}
        onFinishAndSave={handleFinishWorkout}
        onFinishAndDiscard={async () => {
          // Clear active workout from storage when discarding
          if (workoutLog) {
            await clearActiveWorkoutLogId();
          }
          router.back();
        }}
      />

      {/* Session Feedback Modal */}
      <SessionFeedbackModal
        visible={isSessionFeedbackModalVisible}
        onClose={() => {
          setIsSessionFeedbackModalVisible(false);
          router.replace('/workout/workout-summary?workoutLogId=' + workoutLog.id);
        }}
        onSubmit={(data) => {
          console.log('Feedback submitted:', data);
          router.replace('/workout/workout-summary?workoutLogId=' + workoutLog.id);
        }}
      />

      {/* Log Set Performance Modal */}
      <LogSetPerformanceModal
        visible={isLogSetModalVisible}
        onClose={() => setIsLogSetModalVisible(false)}
        exerciseName={currentSetData.exercise.name}
        setLabel={t('workoutSession.setOf', {
          current: currentSetData.setNumber,
          total: currentSetData.totalSetsInExercise,
        })}
        weight={weight}
        reps={reps}
        partials={partials}
        initialRpe={8}
        onConfirm={(data) => {
          handleCompleteSet(data.rpe);
        }}
        onEditSetDetails={(data) => {
          setWeight(data.weight);
          setReps(data.reps);
          setPartials(data.partials);
        }}
      />

      {/* Edit Set Details Modal */}
      <EditSetDetailsModal
        visible={isEditSetModalVisible}
        onClose={() => setIsEditSetModalVisible(false)}
        onSave={handleEditSet}
        setLabel={t('workoutSession.setOf', {
          current: currentSetData.setNumber,
          total: currentSetData.totalSetsInExercise,
        })}
        initialWeight={weight}
        initialReps={reps}
        initialPartials={partials}
      />

      {/* Skip Set Confirmation Modal */}
      <ConfirmationModal
        visible={isSkipSetModalVisible}
        onClose={() => setIsSkipSetModalVisible(false)}
        onConfirm={handleSkipSet}
        title={t('workoutSession.skipSet.title')}
        message={t('workoutSession.skipSet.message')}
        confirmLabel={t('workoutSession.skipSet.confirm')}
        cancelLabel={t('workoutSession.skipSet.cancel')}
        variant="destructive"
      />

      {/* Replace Exercise Modal */}
      <ReplaceExerciseModal
        visible={isReplaceExerciseModalVisible}
        onClose={() => setIsReplaceExerciseModalVisible(false)}
        onReplace={handleReplaceExercise}
        currentExercise={currentSetData.exercise.name}
      />

      {/* Workout History Modal */}
      <WorkoutSessionHistoryModal
        visible={isHistoryModalVisible}
        onClose={() => setIsHistoryModalVisible(false)}
        workoutLog={workoutLog}
        sets={sets}
        exercises={exercises}
        currentSetOrder={progress.currentSetOrder}
      />
    </SafeAreaView>
  );
}
