import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ExerciseTransitionScreen } from '../../components/ExerciseTransitionScreen';
import { MasterLayout } from '../../components/MasterLayout';
import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { database } from '../../database';
import WorkoutLog from '../../database/models/WorkoutLog';
import { theme } from '../../theme';

export default function NewExerciseTransitionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    workoutLogId?: string;
    completedExerciseId?: string;
    nextExerciseId?: string;
  }>();

  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [completedExercise, setCompletedExercise] = useState<string>('');
  const [nextExercise, setNextExercise] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!params.workoutLogId) {
        setError('No workout ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Load workout log
        const log = await database.get<WorkoutLog>('workout_logs').find(params.workoutLogId);
        if (log.deletedAt) {
          throw new Error('Workout has been deleted');
        }
        setWorkoutLog(log);

        // Load completed exercise details if provided
        if (params.completedExerciseId) {
          // You would typically fetch exercise details from your exercises table
          // For now, using a placeholder
          setCompletedExercise('Incline Press');
        }

        // Load next exercise details if provided
        if (params.nextExerciseId) {
          // You would typically fetch exercise details from your exercises table
          // For now, using the example data from the HTML
          setNextExercise({
            name: 'Overhead Press',
            muscleGroups: 'Shoulders • Deltoids',
            imageUri:
              'https://lh3.googleusercontent.com/aida-public/AB6AXuAtx3DJCjqltI-696OEVBkjMgvucGnAa4InH_UXtdpGE67rrLxL7g1tRbWbH0mWPwivuP4y5LZXG0YkQ3Iul_eHsTXzvZq6GjOtnJD0Pt2NHwsAQuBUiXYN_Di5B9iL8-zfNF_BShU-UdqatC1DOM3JSgvUI1Wcles8xUfq5TkY42qpAMUDKDN4HWzkKJ6yafPV3m2laDTdzydz8oxWg3wFEw0yv79MqgHp4QD5QzkPTtB4KbQVP2FQZuluKA_w54vyL6h0w3ORBXUc',
            targetSets: 4,
            targetReps: '8-10',
            restTime: 90,
            equipment: ['Barbell', 'Bench (Vertical)'],
          });
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading exercise transition data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load workout data');
        setIsLoading(false);
      }
    };

    loadData();
  }, [params.workoutLogId, params.completedExerciseId, params.nextExerciseId]);

  const handleStartNextExercise = () => {
    if (params.workoutLogId) {
      router.replace(`/workout/workout-session?workoutLogId=${params.workoutLogId}`);
    }
  };

  const formatTotalTime = (startTime: Date) => {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  if (error || !workoutLog) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center px-6">
          <ErrorStateCard
            icon={WifiOff}
            title={error || 'Workout not found'}
            description="Unable to load exercise transition screen. Please try again."
            buttonLabel="Go Back"
            onButtonPress={() => router.back()}
          />
        </View>
      </MasterLayout>
    );
  }

  return (
    <MasterLayout showNavigationMenu={false}>
      <StatusBar style="light" />
      <ExerciseTransitionScreen
        totalTime={
          workoutLog.startedAt ? formatTotalTime(new Date(workoutLog.startedAt)) : '00:00:00'
        }
        completedExercise={completedExercise}
        nextExercise={nextExercise}
        onStartNextExercise={handleStartNextExercise}
      />
    </MasterLayout>
  );
}
