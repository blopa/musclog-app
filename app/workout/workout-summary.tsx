import { useLocalSearchParams, useRouter } from 'expo-router';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Share, View } from 'react-native';

import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { useUnreadChat } from '../../components/UnreadChatContext';
import { WorkoutSummaryCelebration } from '../../components/WorkoutSummaryCelebration';
import { ChatService, GoogleAuthService, WorkoutService } from '../../database/services';
import { SettingsService } from '../../database/services/SettingsService';
import { useSettings } from '../../hooks/useSettings';
import { theme } from '../../theme';
import { getCurrentChatSessionId, setCurrentChatSessionId } from '../../utils/chatSessionStorage';
import { type CoachAIConfig, getRecentWorkoutInsights } from '../../utils/coachAI';
import { getAccessToken } from '../../utils/googleAuth';
import { showSnackbar } from '../../utils/snackbarService';
import { kgToDisplay } from '../../utils/unitConversion';
import { getWeightUnitI18nKey } from '../../utils/units';
import { processFeedbackResponse } from '../../utils/workoutAI';

async function resolveAIConfig(): Promise<CoachAIConfig | null> {
  try {
    const oauthGeminiEnabled = await GoogleAuthService.getOAuthGeminiEnabled();
    if (oauthGeminiEnabled) {
      const accessToken = await getAccessToken();
      if (accessToken) {
        return {
          provider: 'gemini',
          accessToken,
          model: (await SettingsService.getGoogleGeminiModel()) || 'gemini-2.5-flash',
        };
      }
    }
    const enableGoogleGemini = await SettingsService.getEnableGoogleGemini();
    const googleGeminiApiKey = await SettingsService.getGoogleGeminiApiKey();
    if (enableGoogleGemini && googleGeminiApiKey) {
      return {
        provider: 'gemini',
        apiKey: googleGeminiApiKey,
        model: (await SettingsService.getGoogleGeminiModel()) || 'gemini-2.5-flash',
      };
    }
    const enableOpenAi = await SettingsService.getEnableOpenAi();
    const openAiApiKey = await SettingsService.getOpenAiApiKey();
    if (enableOpenAi && openAiApiKey) {
      return {
        provider: 'openai',
        apiKey: openAiApiKey,
        model: (await SettingsService.getOpenAiModel()) || 'gpt-4o',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutLogId?: string }>();
  const workoutLogId = params.workoutLogId;
  const { setUnreadCount } = useUnreadChat();
  const { units } = useSettings();
  const processedWorkoutRef = useRef<string | null>(null);

  const [totalTime, setTotalTime] = useState<string>('0m');
  const [volume, setVolume] = useState<string>('0 kg');
  const [caloriesBurned, setCaloriesBurned] = useState<number>(0);
  const [personalRecords, setPersonalRecords] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  useEffect(() => {
    const loadWorkoutData = async () => {
      if (!workoutLogId) {
        setError(t('workout.summary.noWorkoutId'));
        setIsLoading(false);
        return;
      }

      // Prevent processing the same workout multiple times
      if (processedWorkoutRef.current === workoutLogId) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get workout with details
        const { workoutLog } = await WorkoutService.getWorkoutWithDetails(workoutLogId);

        // Get or create the shared coach chat session
        let chatSessionId = await getCurrentChatSessionId();
        if (!chatSessionId) {
          chatSessionId = ChatService.generateSessionId();
          await setCurrentChatSessionId(chatSessionId);
        }
        setSessionId(chatSessionId);

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
        let durationStr = '0m';
        if (completedWorkout.startedAt && completedWorkout.completedAt) {
          const durationMs = completedWorkout.completedAt - completedWorkout.startedAt;
          const durationMinutes = Math.round(durationMs / 60000);
          if (durationMinutes < 60) {
            durationStr = `${durationMinutes}m`;
          } else {
            const hours = Math.floor(durationMinutes / 60);
            const mins = durationMinutes % 60;
            durationStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
          }
          setTotalTime(durationStr);
        }

        // Format volume with user's preferred units
        const weightUnitKey = getWeightUnitI18nKey(units);
        const weightUnit = t(weightUnitKey);
        let volumeStr = `0 ${weightUnit}`;
        if (completedWorkout.totalVolume) {
          const displayVolume = kgToDisplay(completedWorkout.totalVolume, units);
          const formattedVolume = displayVolume.toLocaleString('en-US', {
            maximumFractionDigits: 0,
          });
          volumeStr = `${formattedVolume} ${weightUnit}`;
          setVolume(volumeStr);
        }

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

        // Save workout completion message to the shared coach chat session
        await ChatService.saveMessage({
          sessionId: chatSessionId,
          sender: 'coach',
          message: t('workoutSummary.completedMessage', {
            workoutName: completedWorkout.workoutName,
          }),
          summarizedMessage: t('workoutSummary.completedSummary', {
            workoutName: completedWorkout.workoutName,
          }),
          payloadJson: JSON.stringify({
            type: 'workoutCompleted',
            workoutLogId,
            workoutName: completedWorkout.workoutName,
            volume: volumeStr,
            duration: durationStr,
            personalRecords: prsCount,
          }),
        });

        // Mark this workout as processed to prevent duplicate messages
        processedWorkoutRef.current = workoutLogId;
        setUnreadCount((prev) => prev + 1);

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading workout summary:', err);
        setError(err instanceof Error ? err.message : t('workout.summary.failedToLoad'));
        setIsLoading(false);
      }
    };

    loadWorkoutData();
  }, [setUnreadCount, t, units, workoutLogId]);

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

  const handleGetFeedback = async () => {
    if (!workoutLogId || !sessionId) {
      showSnackbar('error', t('workout.summary.noWorkoutId'));
      return;
    }

    setIsFeedbackLoading(true);
    try {
      const aiConfig = await resolveAIConfig();
      if (!aiConfig) {
        showSnackbar('error', t('ai.settings.notConfigured'));
        setIsFeedbackLoading(false);
        return;
      }

      const feedback = await getRecentWorkoutInsights(aiConfig, workoutLogId);

      if (feedback) {
        await processFeedbackResponse(feedback, sessionId);
        setUnreadCount((prev) => prev + 1);
        showSnackbar('success', t('workout.summary.feedbackReceived'));
        // Navigate to chat to show the feedback
        router.push('/coach');
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
      onGetFeedback={isFeedbackLoading ? undefined : handleGetFeedback}
      totalTime={totalTime}
      volume={volume}
      personalRecords={personalRecords}
    />
  );
}
