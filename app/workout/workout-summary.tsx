import { useLocalSearchParams, useRouter } from 'expo-router';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Share, View } from 'react-native';

import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { useUnreadChat } from '../../components/UnreadChatContext';
import { WorkoutSummaryCelebration } from '../../components/WorkoutSummaryCelebration';
import { ChatService, GoogleAuthService, WorkoutService } from '../../database/services';
import { SettingsService } from '../../database/services/SettingsService';
import { theme } from '../../theme';
import {
  calculateNextWorkoutVolume,
  type CoachAIConfig,
  getRecentWorkoutInsights,
} from '../../utils/coachAI';
import { getAccessToken } from '../../utils/googleAuth';
import { showSnackbar } from '../../utils/snackbarService';
import {
  prepareWorkoutDataForAI,
  processCalculateVolumeResponse,
  processFeedbackResponse,
} from '../../utils/workoutAI';

/**
 * Helper: Resolve AI config from settings
 */
async function resolveAIConfig(): Promise<CoachAIConfig | null> {
  try {
    // Priority 1: Google OAuth access token
    const oauthGeminiEnabled = await GoogleAuthService.getOAuthGeminiEnabled();
    if (oauthGeminiEnabled) {
      const accessToken = await getAccessToken();
      if (accessToken) {
        const model = await SettingsService.getGoogleGeminiModel();
        return {
          provider: 'gemini',
          accessToken,
          model: model || 'gemini-2.5-flash',
        };
      }
    }

    // Priority 2: Manual Gemini API key
    const enableGoogleGemini = await SettingsService.getEnableGoogleGemini();
    const googleGeminiApiKey = await SettingsService.getGoogleGeminiApiKey();
    if (enableGoogleGemini && googleGeminiApiKey) {
      const model = await SettingsService.getGoogleGeminiModel();
      return {
        provider: 'gemini',
        apiKey: googleGeminiApiKey,
        model: model || 'gemini-2.5-flash',
      };
    }

    // Priority 3: OpenAI API key
    const enableOpenAi = await SettingsService.getEnableOpenAi();
    const openAiApiKey = await SettingsService.getOpenAiApiKey();
    if (enableOpenAi && openAiApiKey) {
      const model = await SettingsService.getOpenAiModel();
      return {
        provider: 'openai',
        apiKey: openAiApiKey,
        model: model || 'gpt-4o',
      };
    }

    return null;
  } catch (error) {
    console.error('[resolveAIConfig] Error:', error);
    return null;
  }
}

export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutLogId?: string }>();
  const workoutLogId = params.workoutLogId;
  const { unreadCount, setUnreadCount } = useUnreadChat();

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

      try {
        setIsLoading(true);
        setError(null);

        // Get workout with details
        const { workoutLog, sets } = await WorkoutService.getWorkoutWithDetails(workoutLogId);

        // Create or use existing session ID
        const newSessionId = ChatService.generateSessionId();
        setSessionId(newSessionId);

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

        // Trigger non-blocking volume calculation after a short delay
        setTimeout(async () => {
          try {
            console.log('[WorkoutSummary] Starting post-workout volume calculation...');
            const aiConfig = await resolveAIConfig();
            if (!aiConfig) {
              console.log('[WorkoutSummary] AI config not available, skipping volume calculation');
              return;
            }

            const workoutData = await prepareWorkoutDataForAI(workoutLogId);
            const volumeResponse = await calculateNextWorkoutVolume(
              aiConfig,
              completedWorkout.workoutName,
              workoutData
            );

            if (volumeResponse) {
              await processCalculateVolumeResponse(volumeResponse, workoutLogId, newSessionId);
              // Increment unread chat count
              setUnreadCount(unreadCount + 1);
              console.log('[WorkoutSummary] Volume calculation completed');
            }
          } catch (err) {
            console.error('[WorkoutSummary] Error in volume calculation:', err);
            // Non-blocking, so we don't show an error to the user
          }
        }, 2000);

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

      const { workoutLog } = await WorkoutService.getWorkoutWithDetails(workoutLogId);
      const feedback = await getRecentWorkoutInsights(aiConfig, workoutLog.workoutName);

      if (feedback) {
        await processFeedbackResponse(feedback, sessionId);
        // Increment unread chat count
        setUnreadCount(unreadCount + 1);
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
