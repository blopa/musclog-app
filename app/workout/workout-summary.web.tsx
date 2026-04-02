import { useLocalSearchParams, useRouter } from 'expo-router';
import { Dumbbell, Home, MessageCircle, Star, Timer, Trophy, TrendingUp, WifiOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { useUnreadChat } from '../../context/UnreadChatContext';
import type { WorkoutCompletedPayload } from '../../database/models/ChatMessage';
import { ChatService, WorkoutAnalytics, WorkoutService } from '../../database/services';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import AiService from '../../services/AiService';
import { getRecentWorkoutInsights } from '../../utils/coachAI';
import { formatAppInteger } from '../../utils/formatAppNumber';
import { formatDisplayWeightKg } from '../../utils/formatDisplayWeight';
import { showSnackbar } from '../../utils/snackbarService';
import { getWeightUnitI18nKey } from '../../utils/units';
import { buildWorkoutCompletedSummaryForLLM, processFeedbackResponse } from '../../utils/workoutAI';

export default function WorkoutSummaryScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
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
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  useEffect(() => {
    const loadWorkoutData = async () => {
      if (!workoutLogId) {
        setError(t('workout.summary.noWorkoutId'));
        setIsLoading(false);
        return;
      }

      if (processedWorkoutRef.current === workoutLogId) {
        return;
      }
      processedWorkoutRef.current = workoutLogId;

      try {
        setIsLoading(true);
        setError(null);

        const { workoutLog } = await WorkoutService.getWorkoutWithDetails(workoutLogId);

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

        const weightUnitKey = getWeightUnitI18nKey(units);
        const weightUnit = t(weightUnitKey);
        let volumeStr = `0 ${weightUnit}`;
        if (completedWorkout.totalVolume) {
          const locale = i18n.resolvedLanguage ?? i18n.language;
          const formattedVolume = formatDisplayWeightKg(locale, units, completedWorkout.totalVolume);
          volumeStr = `${formattedVolume} ${weightUnit}`;
          setVolume(volumeStr);
        }

        if (completedWorkout.caloriesBurned && completedWorkout.caloriesBurned > 0) {
          setCaloriesBurned(completedWorkout.caloriesBurned);
        }

        const prsCount =
          personalRecordsData && Array.isArray(personalRecordsData)
            ? personalRecordsData.length
            : 0;
        setPersonalRecords(prsCount);

        const llmSummary = await buildWorkoutCompletedSummaryForLLM(workoutLogId, {
          volumeStr,
          durationStr,
          personalRecords: prsCount,
          weightUnit,
          format: 'json',
        });

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
      ...(personalRecords > 0
        ? [`🏆 ${personalRecords} PR${personalRecords > 1 ? 's' : ''}`]
        : []),
    ];
    try {
      await navigator.share?.({ text: lines.join('\n') });
    } catch {
      // share not supported or cancelled
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
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background.primary,
          height: '100%',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: `3px solid ${theme.colors.accent.primary}`,
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
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

  const gradientCta = theme.colors.gradients.cta;
  const gradientCtaStr = `linear-gradient(90deg, ${gradientCta[0]}, ${gradientCta[1]})`;

  const timeValue = totalTime.replace(/\s*(m|min|minutes?)/i, '');
  const timeSuffix = totalTime.match(/\s*(m|min|minutes?)/i)?.[1] ?? t('common.min');
  const volumeValue = volume.replace(/\s*(kg|g|lbs?)/i, '').trim();
  const volumeSuffix = volume.match(/\s*(kg|g|lbs?)/i)?.[1] ?? 'kg';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background.primary,
        height: '100%',
        overflowY: 'auto',
        position: 'relative',
        padding: `${theme.spacing.padding.xl}px ${theme.spacing.padding.xl}px`,
        boxSizing: 'border-box',
      }}
    >
      {/* Background glows */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 256,
          height: 256,
          borderRadius: 128,
          backgroundColor: theme.colors.status.indigo10,
          filter: 'blur(48px)',
          opacity: 0.7,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '33%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 192,
          height: 192,
          borderRadius: 96,
          backgroundColor: theme.colors.status.emerald20,
          filter: 'blur(48px)',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      />

      {/* Trophy */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <div
          style={{
            width: 128,
            height: 128,
            borderRadius: 64,
            backgroundColor: theme.colors.status.indigo10,
            border: `1px solid ${theme.colors.background.white5}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(135deg, ${theme.colors.status.indigo10}, ${theme.colors.status.emerald10})`,
              borderRadius: 64,
            }}
          />
          <Trophy
            size={theme.size['16']}
            color={theme.colors.accent.primary}
            strokeWidth={theme.strokeWidth.medium}
          />
        </div>
        {/* Stars */}
        <div style={{ position: 'absolute', top: -8, right: -8 }}>
          <Star size={theme.iconSize.lg} color={theme.colors.status.amber} fill={theme.colors.status.amber} />
        </div>
        <div style={{ position: 'absolute', bottom: -4, left: -16 }}>
          <Star size={theme.iconSize.md} color={theme.colors.accent.primary} fill={theme.colors.accent.primary} />
        </div>
        <div style={{ position: 'absolute', top: 0, left: -8 }}>
          <Star size={theme.iconSize.sm} color={theme.colors.status.indigoLight} fill={theme.colors.status.indigoLight} />
        </div>
      </div>

      {/* Title */}
      <span
        style={{
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.extrabold,
          textAlign: 'center',
          letterSpacing: theme.typography.letterSpacing.tight,
          marginBottom: theme.spacing.padding.sm,
          background: `linear-gradient(90deg, ${theme.colors.gradients.celebrationGlow[0]}, ${theme.colors.gradients.celebrationGlow[1]})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {t('workoutSummary.youCrushedIt')}
      </span>

      {/* Subtitle */}
      <span
        style={{
          textAlign: 'center',
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.medium,
          color: theme.colors.text.secondary,
          marginBottom: theme.spacing.padding['2xl'],
        }}
      >
        {t('workoutSummary.feedbackSubmitted')}
      </span>

      {/* Stats card */}
      <div
        style={{
          width: '100%',
          borderRadius: theme.borderRadius.xl,
          backgroundColor: theme.colors.background.cardElevated,
          border: `1px solid ${theme.colors.background.white5}`,
          padding: `${theme.spacing.padding.xl}px`,
          boxSizing: 'border-box',
          marginBottom: theme.spacing.padding.xl,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Workout card gradient top bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, ${theme.colors.gradients.workoutStats[0]}, ${theme.colors.gradients.workoutStats[1]})`,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Total Time */}
          <StatRow
            icon={Timer}
            label={t('workoutSummary.totalTime')}
            value={timeValue}
            valueSuffix={timeSuffix}
            iconBgColor={theme.colors.status.info10}
            iconColor={theme.colors.status.info}
            iconSize={theme.iconSize.lg}
            showDivider
          />
          {/* Volume */}
          <StatRow
            icon={Dumbbell}
            label={t('workoutSummary.volume')}
            value={volumeValue}
            valueSuffix={volumeSuffix}
            iconBgColor={theme.colors.status.emerald10}
            iconColor={theme.colors.status.emeraldLight}
            iconSize={theme.iconSize.lg}
            showDivider
          />
          {/* Personal Records */}
          <StatRow
            icon={TrendingUp}
            label={t('workoutSummary.personalRecords')}
            value={String(personalRecords)}
            iconBgColor={theme.colors.status.amber10}
            iconColor={theme.colors.status.amber}
            iconSize={theme.iconSize.lg}
            showDivider={false}
            showStarIcon
            starColor={theme.colors.status.amber}
          />
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Get Feedback Button */}
      <button
        onClick={handleGetFeedback}
        disabled={isFeedbackLoading}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: `${theme.spacing.padding.base}px`,
          borderRadius: theme.borderRadius.xl,
          border: `1px solid ${theme.colors.border.default}`,
          backgroundColor: theme.colors.background.overlay,
          color: theme.colors.text.primary,
          fontSize: theme.typography.fontSize.base,
          fontWeight: theme.typography.fontWeight.bold,
          cursor: isFeedbackLoading ? 'not-allowed' : 'pointer',
          opacity: isFeedbackLoading ? 0.6 : 1,
          marginBottom: theme.spacing.padding.base,
          boxSizing: 'border-box',
          letterSpacing: '0.05em',
        }}
      >
        <MessageCircle size={theme.iconSize.md} color={theme.colors.text.primary} />
        <span>{isFeedbackLoading ? t('workoutSummary.gettingFeedback') : t('workoutSummary.getFeedback')}</span>
      </button>

      {/* Go Home Button */}
      <button
        onClick={handleGoHome}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: `${theme.spacing.padding.base}px`,
          borderRadius: theme.borderRadius.xl,
          border: 'none',
          background: gradientCtaStr,
          color: theme.colors.text.onColorful,
          fontSize: theme.typography.fontSize.base,
          fontWeight: theme.typography.fontWeight.bold,
          cursor: 'pointer',
          marginBottom: theme.spacing.padding.base,
          boxSizing: 'border-box',
          letterSpacing: '0.05em',
        }}
      >
        <Home size={theme.iconSize.md} color={theme.colors.text.onColorful} />
        <span>{t('workoutSummary.goHome')}</span>
      </button>

      {/* Share link */}
      <button
        onClick={handleShareSummary}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: theme.colors.text.tertiary,
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.medium,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          padding: `${theme.spacing.padding.sm}px`,
        }}
      >
        {t('workoutSummary.shareSummary')}
      </button>
    </div>
  );
}

type StatRowProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  valueSuffix?: string;
  iconBgColor: string;
  iconColor: string;
  iconSize: number;
  showDivider?: boolean;
  showStarIcon?: boolean;
  starColor?: string;
};

function StatRow({
  icon: Icon,
  label,
  value,
  valueSuffix,
  iconBgColor,
  iconColor,
  iconSize,
  showDivider = true,
  showStarIcon = false,
  starColor,
}: StatRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: showDivider ? 16 : 0,
        borderBottom: showDivider ? '1px solid rgba(255,255,255,0.05)' : 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            borderRadius: 8,
            padding: 8,
            backgroundColor: iconBgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={iconSize} color={iconColor} />
        </div>
        <span style={{ fontWeight: 500, color: 'var(--text-secondary, #9ca3af)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {showStarIcon && starColor ? (
          <Star size={16} color={starColor} fill={starColor} />
        ) : null}
        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary, #fff)' }}>
          {value}
        </span>
        {valueSuffix ? (
          <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-tertiary, #6b7280)' }}>
            {valueSuffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}
