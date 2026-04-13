import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { ErrorStateCard } from '@/components/theme/ErrorStateCard';
import { WorkoutSummaryCelebration } from '@/components/WorkoutSummaryCelebration';
import { useUnreadChat } from '@/context/UnreadChatContext';
import type { WorkoutCompletedPayload } from '@/database/models/ChatMessage';
import {
  ChatService,
  ExerciseGoalService,
  WorkoutAnalytics,
  WorkoutService,
} from '@/database/services';
import { useNativeShareText } from '@/hooks/useNativeShareText';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import AiService from '@/services/AiService';
import { getRecentWorkoutInsights } from '@/utils/coachAI';
import { formatAppInteger } from '@/utils/formatAppNumber';
import { displayWeightKgNumeric, formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { showSnackbar } from '@/utils/snackbarService';
import { getWeightUnitI18nKey } from '@/utils/units';
import { formatWorkoutDuration } from '@/utils/workout';
import { buildWorkoutCompletedSummaryForLLM, processFeedbackResponse } from '@/utils/workoutAI';

export default function WorkoutSummaryScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutLogId?: string }>();
  const workoutLogId = params.workoutLogId;
  const { setUnreadCount } = useUnreadChat();
  const { units } = useSettings();
  const { shareText } = useNativeShareText();
  const processedWorkoutRef = useRef<string | null>(null);

  const [totalTime, setTotalTime] = useState<string>('0m');
  const [volume, setVolume] = useState<string>('');
  const [caloriesBurned, setCaloriesBurned] = useState<number>(0);
  const [personalRecords, setPersonalRecords] = useState<number>(0);
  const [goalProgress, setGoalProgress] = useState<
    { exerciseName: string; current: number; target: number; unit: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  // Keep screen awake during AI workout feedback generation
  useEffect(() => {
    if (isFeedbackLoading) {
      activateKeepAwakeAsync('workout-feedback').catch(() => {});
    } else {
      deactivateKeepAwake('workout-feedback').catch(() => {});
    }

    return () => {
      deactivateKeepAwake('workout-feedback').catch(() => {});
    };
  }, [isFeedbackLoading]);

  useEffect(() => {
    const loadWorkoutData = async () => {
      if (!workoutLogId) {
        setError(t('workout.summary.noWorkoutId'));
        setIsLoading(false);
        return;
      }

      // Prevent processing the same workout multiple times.
      // Must be set before the first await to prevent re-runs triggered by
      // dependency changes (e.g. units/i18n loading) from racing past this guard.
      if (processedWorkoutRef.current === workoutLogId) {
        return;
      }

      processedWorkoutRef.current = workoutLogId;

      try {
        setIsLoading(true);
        setError(null);

        // Get workout with details
        const { workoutLog } = await WorkoutService.getWorkoutWithDetails(workoutLogId);

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
          personalRecordsData = await WorkoutAnalytics.detectPersonalRecords(workoutLog);
        }

        // Calculate total time
        let durationStr = `0 ${t('common.min')}`;
        if (completedWorkout.startedAt && completedWorkout.completedAt) {
          const durationMs = completedWorkout.completedAt - completedWorkout.startedAt;
          const durationMinutes = Math.round(durationMs / 60000);
          const { value, suffix } = formatWorkoutDuration(durationMinutes);
          durationStr = suffix ? `${value} ${suffix}` : value;
          setTotalTime(durationStr);
        }

        // Format volume with user's preferred units
        const weightUnitKey = getWeightUnitI18nKey(units);
        const weightUnit = t(weightUnitKey);
        let volumeStr = `0 ${weightUnit}`;
        if (completedWorkout.totalVolume) {
          const locale = i18n.resolvedLanguage ?? i18n.language;
          const formattedVolume = formatDisplayWeightKg(
            locale,
            units,
            completedWorkout.totalVolume
          );
          volumeStr = `${formattedVolume} ${weightUnit}`;
        }

        setVolume(volumeStr);

        // Set calories burned
        if (completedWorkout.caloriesBurned && completedWorkout.caloriesBurned > 0) {
          setCaloriesBurned(completedWorkout.caloriesBurned);
        }

        // Set personal records count
        const prsCount =
          personalRecordsData && Array.isArray(personalRecordsData)
            ? personalRecordsData.length
            : 0;
        setPersonalRecords(prsCount);

        // Check for goal progress
        const relevantExerciseIds = [...new Set(personalRecordsData.map((pr) => pr.exerciseId))];
        const progress: {
          exerciseName: string;
          current: number;
          target: number;
          unit: string;
        }[] = [];

        for (const exerciseId of relevantExerciseIds) {
          const activeGoals = await ExerciseGoalService.getActiveGoalsForExercise(exerciseId);
          const prForExercise = personalRecordsData.find(
            (pr) => pr.exerciseId === exerciseId && pr.type === 'weight'
          );

          if (prForExercise && activeGoals.length > 0) {
            for (const goal of activeGoals) {
              if (goal.goalType === '1rm' && goal.targetWeight) {
                progress.push({
                  exerciseName: goal.exerciseNameSnapshot || prForExercise.exerciseName,
                  current: displayWeightKgNumeric(prForExercise.newRecord.weight, units),
                  target: displayWeightKgNumeric(goal.targetWeight, units),
                  unit: weightUnit,
                });
              }
            }
          }
        }
        setGoalProgress(progress);

        // Build rich summary for the LLM (as if the user said "I just completed...")
        const llmSummary = await buildWorkoutCompletedSummaryForLLM(workoutLogId, {
          volumeStr,
          durationStr,
          personalRecords: prsCount,
          weightUnit,
          format: 'json',
        });

        // Save workout completion message to the shared coach chat session.
        // UI shows it as a card from Loggy; when sending to the LLM we use llmSummary as a user message.
        const workoutCompletedPayload: WorkoutCompletedPayload = {
          type: 'workoutCompleted',
          workoutLogId,
          workoutName: completedWorkout.workoutName,
          volume: volumeStr,
          duration: durationStr,
          personalRecords: prsCount,
          weightUnit,
        };
        await ChatService.saveMessage({
          sender: 'coach',
          message: t('workoutSummary.completedMessage', {
            workoutName: completedWorkout.workoutName,
          }),
          context: 'exercise',
          summarizedMessage: llmSummary,
          payloadJson: JSON.stringify(workoutCompletedPayload),
        });

        setUnreadCount((prev) => prev + 1);

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading workout summary:', err);
        setError(err instanceof Error ? err.message : t('workout.summary.failedToLoad'));
        setIsLoading(false);
      }
    };

    loadWorkoutData();
  }, [i18n.language, i18n.resolvedLanguage, setUnreadCount, t, units, workoutLogId]);

  const handleGoHome = () => {
    router.replace('/');
  };

  const handleShareSummary = async () => {
    const locale = i18n.resolvedLanguage ?? i18n.language;
    const lines = [
      t('workoutSummary.shareText'),
      '',
      `⏱ ${totalTime}`,
      `🏋️ ${volume}`,
      ...(caloriesBurned > 0 ? [`🔥 ${formatAppInteger(locale, caloriesBurned)} kcal`] : []),
      ...(personalRecords > 0 ? [`🏆 ${personalRecords} PR${personalRecords > 1 ? 's' : ''}`] : []),
    ];

    try {
      await shareText(lines.join('\n'));
    } catch (err) {
      console.error('Error sharing workout summary:', err);
    }
  };

  const handleGetFeedback = async () => {
    if (!workoutLogId) {
      showSnackbar('error', t('workout.summary.noWorkoutId'));
      return;
    }

    setIsFeedbackLoading(true);
    try {
      const aiConfig = await AiService.getAiConfig();
      if (!aiConfig) {
        showSnackbar('error', t('ai.settings.notConfigured'));
        setIsFeedbackLoading(false);
        return;
      }

      const feedback = await getRecentWorkoutInsights(aiConfig, workoutLogId);

      if (feedback) {
        await processFeedbackResponse(feedback);
        setUnreadCount((prev) => prev + 1);
        showSnackbar('success', t('workout.summary.feedbackReceived'));
        router.replace('/');
      } else {
        showSnackbar('error', t('workout.summary.failedToGetFeedback'));
      }
    } catch (err) {
      console.error('[WorkoutSummary] Error getting feedback:', err);
      showSnackbar('error', t('workout.summary.failedToGetFeedback'));
    } finally {
      setIsFeedbackLoading(false);
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
      onGetFeedback={handleGetFeedback}
      isGetFeedbackLoading={isFeedbackLoading}
      totalTime={totalTime}
      volume={volume}
      personalRecords={personalRecords}
      caloriesBurned={caloriesBurned}
      goalProgress={goalProgress}
    />
  );
}
