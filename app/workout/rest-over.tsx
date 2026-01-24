import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Platform, ActivityIndicator } from 'react-native';
import { Play, WifiOff } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { Button } from '../../components/theme/Button';
import { WorkoutTimeTracker } from '../../components/WorkoutTimeTracker';
import { WorkoutOptionsModal } from '../../components/modals/WorkoutOptionsModal';
import { EndWorkoutModal } from '../../components/modals/EndWorkoutModal';
import { RestOverStatusIcon } from '../../components/RestOverStatusIcon';
import { RestOverTitle } from '../../components/RestOverTitle';
import { RestOverNextExercise } from '../../components/RestOverNextExercise';
import { WorkoutService } from '../../database/services/WorkoutService';
import { database } from '../../database';
import WorkoutLog from '../../database/models/WorkoutLog';
import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { StatusBar } from 'expo-status-bar';
import { clearActiveWorkoutLogId } from '../../utils/activeWorkoutStorage';

export default function RestOverScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ workoutLogId?: string; nextSetOrder?: string }>();
  const workoutLogId = params.workoutLogId;
  const nextSetOrder = params.nextSetOrder ? parseInt(params.nextSetOrder, 10) : null;

  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isEndWorkoutModalVisible, setIsEndWorkoutModalVisible] = useState(false);
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [nextExercise, setNextExercise] = useState<{
    name: string;
    weight: string;
    reps: number;
    set: number;
    totalSets: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Pulse animation for the glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Load next set data
  useEffect(() => {
    const loadData = async () => {
      if (!workoutLogId) {
        setError('No workout ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Load workout log
        const log = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);
        if (log.deletedAt) {
          throw new Error('Workout has been deleted');
        }
        setWorkoutLog(log);

        // Load next set
        if (nextSetOrder !== null) {
          const next = await WorkoutService.getNextSet(workoutLogId, nextSetOrder - 1);
          if (next) {
            // Calculate set number within exercise
            const allSets = await WorkoutService.getWorkoutWithDetails(workoutLogId);
            const exerciseSets = allSets.sets.filter((s) => s.exerciseId === next.set.exerciseId);
            const setNumber = exerciseSets.findIndex((s) => s.id === next.set.id) + 1;

            setNextExercise({
              name: next.exercise.name,
              weight: `${next.set.weight}kg`,
              reps: next.set.reps,
              set: setNumber,
              totalSets: exerciseSets.length,
            });
          }
        } else {
          // Get current set if no next set order provided
          const current = await WorkoutService.getCurrentSet(workoutLogId);
          if (current) {
            const allSets = await WorkoutService.getWorkoutWithDetails(workoutLogId);
            const exerciseSets = allSets.sets.filter(
              (s) => s.exerciseId === current.set.exerciseId
            );
            const setNumber = exerciseSets.findIndex((s) => s.id === current.set.id) + 1;

            setNextExercise({
              name: current.exercise.name,
              weight: `${current.set.weight}kg`,
              reps: current.set.reps,
              set: setNumber,
              totalSets: exerciseSets.length,
            });
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading rest over data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load workout data');
        setIsLoading(false);
      }
    };

    loadData();
  }, [workoutLogId, nextSetOrder]);

  const handleStartNextSet = () => {
    if (workoutLogId) {
      router.replace(`/workout/workout-session?workoutLogId=${workoutLogId}`);
    }
  };

  const handleEndWorkout = () => {
    setIsOptionsModalVisible(false);
    setIsEndWorkoutModalVisible(true);
  };

  const webScreenStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
        } as any)
      : {};

  if (isLoading) {
    return (
      <SafeAreaView
        className="flex-1 bg-bg-primary"
        edges={['top', 'bottom']}
        style={webScreenStyle}
      >
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !workoutLog) {
    return (
      <SafeAreaView
        className="flex-1 bg-bg-primary"
        edges={['top', 'bottom']}
        style={webScreenStyle}
      >
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center px-6">
          <ErrorStateCard
            icon={WifiOff}
            title={error || 'Workout not found'}
            description="Unable to load rest over screen. Please try again."
            buttonLabel="Go Back"
            onButtonPress={() => router.replace('/workout/workouts')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']} style={webScreenStyle}>
      {/* Background Glow Effects */}
      <Animated.View
        className="absolute right-[-10%] top-[-20%] h-[50%] w-[80%] rounded-full blur-3xl"
        style={{
          backgroundColor: theme.colors.accent.primary40,
          opacity: pulseAnim,
        }}
      />
      <Animated.View
        className="absolute bottom-[-10%] left-[-20%] h-[50%] w-[90%] rounded-full blur-3xl"
        style={{
          backgroundColor: theme.colors.status.emerald20,
        }}
      />

      {/* Header */}
      <View className="relative z-20">
        <WorkoutTimeTracker
          onClose={() => router.back()}
          onOptionsPress={() => setIsOptionsModalVisible(true)}
          startTime={workoutLog.startedAt}
        />
      </View>

      {/* Main Content */}
      <View className="z-10 w-full flex-1 items-center justify-center gap-8 px-6">
        <RestOverStatusIcon />
        <RestOverTitle />
        {nextExercise ? <RestOverNextExercise exercise={nextExercise} /> : null}
      </View>

      {/* Footer */}
      <View className="z-10 w-full px-6 pb-12">
        <Button
          label={t('restOver.startNextSet')}
          icon={Play}
          variant="accent"
          size="lg"
          width="full"
          onPress={handleStartNextSet}
        />
      </View>

      {/* Workout Options Modal */}
      <WorkoutOptionsModal
        visible={isOptionsModalVisible}
        onClose={() => setIsOptionsModalVisible(false)}
        onPreviewWorkout={() => router.push('/workout-preview' as any)}
        onWorkoutSettings={() => router.push('/workout-settings' as any)}
        onEndWorkout={handleEndWorkout}
      />

      {/* End Workout Confirmation Modal */}
      <EndWorkoutModal
        visible={isEndWorkoutModalVisible}
        onClose={() => setIsEndWorkoutModalVisible(false)}
        onFinishAndSave={async () => {
          if (workoutLogId) {
            try {
              await WorkoutService.completeWorkout(workoutLogId);
              router.replace(`/workout/workout-summary?workoutLogId=${workoutLogId}`);
            } catch (err) {
              console.error('Error completing workout:', err);
            }
          }
        }}
        onFinishAndDiscard={async () => {
          // Clear active workout from storage when discarding
          if (workoutLogId) {
            await clearActiveWorkoutLogId();
          }
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
