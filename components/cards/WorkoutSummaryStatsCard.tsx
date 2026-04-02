import { Dumbbell, Flame, Timer, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { WorkoutSummaryStatRow } from '../WorkoutSummaryStatRow';
import { GenericCard } from './GenericCard';

type WorkoutSummaryStatsCardProps = {
  totalTime: string;
  volume: string;
  personalRecords: number;
  caloriesBurned?: number;
};

export function WorkoutSummaryStatsCard({
  totalTime,
  volume,
  personalRecords,
  caloriesBurned,
}: WorkoutSummaryStatsCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <GenericCard variant="workout">
      <View className="gap-6">
        <WorkoutSummaryStatRow
          icon={Timer}
          label={t('workoutSummary.totalTime')}
          value={totalTime.replace(/\s*(m|min|minutes?)/i, '')}
          valueSuffix={totalTime.match(/\s*(m|min|minutes?)/i)?.[1] || t('common.min')}
          iconBgColor={theme.colors.status.info10}
          iconColor={theme.colors.status.info}
        />
        <WorkoutSummaryStatRow
          icon={Dumbbell}
          label={t('workoutSummary.volume')}
          value={volume.replace(/\s*(kg|g|lbs?)/i, '').trim()}
          valueSuffix={volume.match(/\s*(kg|g|lbs?)/i)?.[1] || 'kg'}
          iconBgColor={theme.colors.status.emerald10}
          iconColor={theme.colors.status.emeraldLight}
        />
        {caloriesBurned && caloriesBurned > 0 ? (
          <WorkoutSummaryStatRow
            icon={Flame}
            label={t('workoutSummary.caloriesBurned')}
            value={caloriesBurned}
            valueSuffix="kcal"
            iconBgColor={theme.colors.status.error10}
            iconColor={theme.colors.status.error}
          />
        ) : null}
        <WorkoutSummaryStatRow
          icon={TrendingUp}
          label={t('workoutSummary.personalRecords')}
          value={personalRecords}
          iconBgColor={theme.colors.status.amber10}
          iconColor={theme.colors.status.amber}
          showDivider={false}
          showStarIcon={true}
        />
      </View>
    </GenericCard>
  );
}
