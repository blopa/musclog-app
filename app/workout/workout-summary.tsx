import { useLocalSearchParams, useRouter } from 'expo-router';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Share, View } from 'react-native';

import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { WorkoutSummaryCelebration } from '../../components/WorkoutSummaryCelebration';
import { WorkoutService } from '../../database/services';
import { theme } from '../../theme';

export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutLogId?: string }>();
  const workoutLogId = params.workoutLogId;

  const [totalTime, setTotalTime] = useState<string>('0m');
  const [volume, setVolume] = useState<string>('0 kg');
  const [caloriesBurned, setCaloriesBurned] = useState<number>(0);
  const [personalRecords, setPersonalRecords] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWorkoutData = async () => {
      if (!workoutLogId) {
        setError(t('workout.summary.noWorkoutId'));
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get workout with details
        const { workoutLog, sets } = await WorkoutService.getWorkoutWithDetails(workoutLogId);

        // Complete workout if not already completed
        let completedWorkout = workoutLog;
        let personalRecordsData: Awaited<
          ReturnType<typeof WorkoutService.completeWorkout>
        >['personalRecords'] = [];
        if (!workoutLog.completedAt) {
          const result = await WorkoutService.completeWorkout(workoutLogId);
          completedWorkout = result.workoutLog;
          personalRecordsData = result.personalRecords;
        } else {
          // For already completed workout, we need to detect PRs separately
          // For now, set to empty array - can be enhanced later
          personalRecordsData = [];
        }

        // Calculate total time
        if (completedWorkout.startedAt && completedWorkout.completedAt) {
          const durationMs = completedWorkout.completedAt - completedWorkout.startedAt;
          const durationMinutes = Math.round(durationMs / 60000);
          if (durationMinutes < 60) {
            setTotalTime(`${durationMinutes}m`);
          } else {
            const hours = Math.floor(durationMinutes / 60);
            const mins = durationMinutes % 60;
            setTotalTime(mins > 0 ? `${hours}h ${mins}m` : `${hours}h`);
          }
        }

        // Format volume
        if (completedWorkout.totalVolume) {
          // Format with thousands separator
          const formattedVolume = completedWorkout.totalVolume.toLocaleString('en-US');
          setVolume(`${formattedVolume} kg`);
        }

        // Set calories burned
        if (completedWorkout.caloriesBurned && completedWorkout.caloriesBurned > 0) {
          setCaloriesBurned(completedWorkout.caloriesBurned);
        }

        // Set personal records count
        if (personalRecordsData && Array.isArray(personalRecordsData)) {
          setPersonalRecords(personalRecordsData.length);
        } else {
          setPersonalRecords(0);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading workout summary:', err);
        setError(err instanceof Error ? err.message : t('workout.summary.failedToLoad'));
        setIsLoading(false);
      }
    };

    loadWorkoutData();
  }, [t, workoutLogId]);

  const handleGoHome = () => {
    router.replace('/');
  };

  const handleShareSummary = async () => {
    const lines = [
      t('workoutSummary.shareText'),
      '',
      `⏱ ${totalTime}`,
      `🏋️ ${volume}`,
      ...(caloriesBurned > 0 ? [`🔥 ${caloriesBurned} kcal`] : []),
      ...(personalRecords > 0 ? [`🏆 ${personalRecords} PR${personalRecords > 1 ? 's' : ''}`] : []),
    ];

    try {
      await Share.share({ message: lines.join('\n') });
    } catch (err) {
      console.error('Error sharing workout summary:', err);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-primary">
        <ActivityIndicator size="large" color={theme.colors.accent.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-primary px-6">
        <ErrorStateCard
          icon={WifiOff}
          title={error}
          description={t('workout.summary.unableToLoad')}
          buttonLabel={t('common.goHome')}
          onButtonPress={handleGoHome}
        />
      </View>
    );
  }

  return (
    <WorkoutSummaryCelebration
      onGoHome={handleGoHome}
      onShareSummary={handleShareSummary}
      totalTime={totalTime}
      volume={volume}
      personalRecords={personalRecords}
    />
  );
}
