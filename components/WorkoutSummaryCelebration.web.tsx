import { Dumbbell, Flame, Home, MessageCircle, Star, Timer, TrendingUp } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LoggyPose } from '@/components/LoggyPose';
import { useTheme } from '@/hooks/useTheme';
import { splitDurationLabel } from '@/utils/workout';

const SUMMARY_POSE_HEIGHT = 176;

type WorkoutSummaryCelebrationProps = {
  children?: ReactNode;
  onGoHome: () => void;
  onShareSummary?: () => void;
  onGetFeedback?: () => void;
  isGetFeedbackLoading?: boolean;
  totalTime?: string;
  volume?: string;
  personalRecords?: number;
  caloriesBurned?: number;
};

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
  // Theme tokens, not hand-named CSS variables: the app's custom properties are `--c-*` channel
  // triplets, so an invented name never resolved and every theme drew the fallback written beside
  // it (white values on a light card). The divider likewise has to be the theme's ink hairline.
  const theme = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: showDivider ? 16 : 0,
        borderBottom: showDivider ? `1px solid ${theme.colors.background.ink5}` : 'none',
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
        <span style={{ fontWeight: 500, color: theme.colors.text.secondary }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {showStarIcon && starColor ? <Star size={16} color={starColor} fill={starColor} /> : null}
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: theme.colors.text.primary,
          }}
        >
          {value}
        </span>
        {valueSuffix ? (
          <span
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: theme.colors.text.tertiary,
            }}
          >
            {valueSuffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function WorkoutSummaryCelebration({
  children,
  onGoHome,
  onShareSummary,
  onGetFeedback,
  isGetFeedbackLoading = false,
  totalTime = '0m',
  volume = '0 kg',
  personalRecords = 0,
  caloriesBurned,
}: WorkoutSummaryCelebrationProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const gradientCtaStr = theme.colors.accent.primary;
  const workoutStatsStr = theme.colors.accent.primary;

  const { value: timeValue, suffix: timeSuffix } = splitDurationLabel(totalTime);
  const volumeValue = volume.replace(/\s*(kg|g|lbs?)/i, '').trim();
  const volumeSuffix = volume.match(/\s*(kg|g|lbs?)/i)?.[1] ?? 'kg';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background.primary,
        height: '100%',
        overflowY: 'auto',
        position: 'relative',
        padding: theme.spacing.padding.xl,
        boxSizing: 'border-box',
      }}
    >
      {/* The finished workout's face, in place of the trophy and its three stars. */}
      <div style={{ marginBottom: 24 }}>
        <LoggyPose pose="celebrating" height={SUMMARY_POSE_HEIGHT} />
      </div>

      {/* Title */}
      <span
        style={{
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.bold,
          textAlign: 'center',
          marginBottom: theme.spacing.padding.sm,
          color: theme.colors.text.primary,
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
        {t('workoutSummary.workoutSaved')}
      </span>

      {/* Stats card */}
      <div
        style={{
          width: '100%',
          borderRadius: theme.borderRadius.xl,
          backgroundColor: theme.colors.background.cardElevated,
          border: `1px solid ${theme.colors.background.ink5}`,
          padding: theme.spacing.padding.xl,
          boxSizing: 'border-box',
          marginBottom: theme.spacing.padding.xl,
          position: 'relative',
          overflow: 'hidden',
          // A flex column item shrinks on the web; with Next time below it, it was clipped.
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: workoutStatsStr,
            opacity: theme.colors.opacity.medium,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
          <StatRow
            icon={Dumbbell}
            label={t('workoutSummary.volume')}
            value={volumeValue}
            valueSuffix={volumeSuffix}
            iconBgColor={theme.colors.status.brandVivid10}
            iconColor={theme.colors.status.brandBright}
            iconSize={theme.iconSize.lg}
            showDivider
          />
          {caloriesBurned && caloriesBurned > 0 ? (
            <StatRow
              icon={Flame}
              label={t('workoutSummary.caloriesBurned')}
              value={String(caloriesBurned)}
              valueSuffix="kcal"
              iconBgColor={theme.colors.status.error10}
              iconColor={theme.colors.status.error}
              iconSize={theme.iconSize.lg}
              showDivider
            />
          ) : null}
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

      <div style={{ flex: 1 }} />

      {/* Get Feedback Button */}
      {children}
      {onGetFeedback ? (
        <button
          onClick={onGetFeedback}
          disabled={isGetFeedbackLoading}
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: theme.spacing.padding.base,
            borderRadius: theme.borderRadius.xl,
            border: `1px solid ${theme.colors.border.default}`,
            backgroundColor: theme.colors.background.overlay,
            color: theme.colors.text.primary,
            fontSize: theme.typography.fontSize.base,
            fontWeight: theme.typography.fontWeight.bold,
            cursor: isGetFeedbackLoading ? 'not-allowed' : 'pointer',
            opacity: isGetFeedbackLoading ? 0.6 : 1,
            marginBottom: theme.spacing.padding.base,
            boxSizing: 'border-box',
          }}
        >
          <MessageCircle size={theme.iconSize.md} color={theme.colors.text.primary} />
          <span>
            {isGetFeedbackLoading
              ? t('workoutSummary.gettingFeedback')
              : t('workoutSummary.getFeedback')}
          </span>
        </button>
      ) : null}

      {/* Go Home Button */}
      <button
        onClick={onGoHome}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: theme.spacing.padding.base,
          borderRadius: theme.borderRadius.xl,
          border: 'none',
          background: gradientCtaStr,
          color: theme.colors.text.alwaysWhite,
          fontSize: theme.typography.fontSize.base,
          fontWeight: theme.typography.fontWeight.bold,
          cursor: 'pointer',
          marginBottom: theme.spacing.padding.base,
          boxSizing: 'border-box',
        }}
      >
        <Home size={theme.iconSize.md} color={theme.colors.text.alwaysWhite} />
        <span>{t('workoutSummary.goHome')}</span>
      </button>

      {/* Share link */}
      {onShareSummary ? (
        <button
          onClick={onShareSummary}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: theme.colors.text.tertiary,
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            padding: theme.spacing.padding.sm,
          }}
        >
          {t('workoutSummary.shareSummary')}
        </button>
      ) : null}
    </div>
  );
}
