import {
  Dumbbell,
  Flame,
  Home,
  MessageCircle,
  Star,
  Timer,
  TrendingUp,
  Trophy,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../hooks/useTheme';

type WorkoutSummaryCelebrationProps = {
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
        {showStarIcon && starColor ? <Star size={16} color={starColor} fill={starColor} /> : null}
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.5px',
            color: 'var(--text-primary, #fff)',
          }}
        >
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

export function WorkoutSummaryCelebration({
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

  const gradientCtaStr = `linear-gradient(90deg, ${theme.colors.gradients.cta[0]}, ${theme.colors.gradients.cta[1]})`;
  const celebrationGlowStr = `linear-gradient(90deg, ${theme.colors.gradients.celebrationGlow[0]}, ${theme.colors.gradients.celebrationGlow[1]})`;
  const workoutStatsStr = `linear-gradient(90deg, ${theme.colors.gradients.workoutStats[0]}, ${theme.colors.gradients.workoutStats[1]})`;

  const timeValue = totalTime.replace(/\s*(m|min|minutes?)/i, '');
  const timeSuffix = totalTime.match(/\s*(m|min|minutes?)/i)?.[1] ?? t('common.min');
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
            border: `1px solid ${theme.colors.background.white5}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${theme.colors.status.indigo10}, ${theme.colors.status.emerald10})`,
          }}
        >
          <Trophy
            size={theme.size['16']}
            color={theme.colors.accent.primary}
            strokeWidth={theme.strokeWidth.medium}
          />
        </div>
        <div style={{ position: 'absolute', top: -8, right: -8 }}>
          <Star
            size={theme.iconSize.lg}
            color={theme.colors.status.amber}
            fill={theme.colors.status.amber}
          />
        </div>
        <div style={{ position: 'absolute', bottom: -4, left: -16 }}>
          <Star
            size={theme.iconSize.md}
            color={theme.colors.accent.primary}
            fill={theme.colors.accent.primary}
          />
        </div>
        <div style={{ position: 'absolute', top: 0, left: -8 }}>
          <Star
            size={theme.iconSize.sm}
            color={theme.colors.status.indigoLight}
            fill={theme.colors.status.indigoLight}
          />
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
          background: celebrationGlowStr,
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
          padding: theme.spacing.padding.xl,
          boxSizing: 'border-box',
          marginBottom: theme.spacing.padding.xl,
          position: 'relative',
          overflow: 'hidden',
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
            iconBgColor={theme.colors.status.emerald10}
            iconColor={theme.colors.status.emeraldLight}
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
            letterSpacing: '0.05em',
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
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: theme.spacing.padding.sm,
          }}
        >
          {t('workoutSummary.shareSummary')}
        </button>
      ) : null}
    </div>
  );
}
