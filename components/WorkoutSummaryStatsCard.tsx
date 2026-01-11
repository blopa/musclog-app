import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Timer, Dumbbell, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { WorkoutSummaryStatRow } from './WorkoutSummaryStatRow';

type WorkoutSummaryStatsCardProps = {
  totalTime: string;
  volume: string;
  personalRecords: number;
};

export function WorkoutSummaryStatsCard({
  totalTime,
  volume,
  personalRecords,
}: WorkoutSummaryStatsCardProps) {
  const { t } = useTranslation();
  return (
    <View
      className="mb-8 w-full overflow-hidden rounded-[20px] border p-6"
      style={{
        backgroundColor: theme.colors.background.darkGreen80,
        borderColor: theme.colors.background.white5,
        borderWidth: theme.borderWidth.thin,
        ...theme.shadows.lg,
      }}>
      {/* Top gradient line */}
      <LinearGradient
        colors={theme.colors.gradients.workoutStats}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: theme.size['1half'],
          opacity: 0.5,
        }}
      />

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
    </View>
  );
}
