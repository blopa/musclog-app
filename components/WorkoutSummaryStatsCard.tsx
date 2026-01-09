import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Timer, Dumbbell, TrendingUp } from 'lucide-react-native';
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
  return (
    <View
      className="mb-8 w-full overflow-hidden rounded-[20px] border p-6"
      style={{
        backgroundColor: 'rgba(27, 50, 39, 0.8)',
        borderColor: theme.colors.background.white5,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
      }}>
      {/* Top gradient line */}
      <LinearGradient
        colors={['#818cf8', theme.colors.accent.primary, '#34d399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          opacity: 0.5,
        }}
      />

      <View className="gap-6">
        <WorkoutSummaryStatRow
          icon={Timer}
          label="Total Time"
          value={totalTime.replace(/\s*(m|min|minutes?)/i, '')}
          valueSuffix={totalTime.match(/\s*(m|min|minutes?)/i)?.[1] || 'm'}
          iconBgColor="rgba(59, 130, 246, 0.1)"
          iconColor="#3b82f6"
        />
        <WorkoutSummaryStatRow
          icon={Dumbbell}
          label="Volume"
          value={volume.replace(/\s*(kg|g|lbs?)/i, '').trim()}
          valueSuffix={volume.match(/\s*(kg|g|lbs?)/i)?.[1] || 'kg'}
          iconBgColor="rgba(41, 224, 142, 0.1)"
          iconColor={theme.colors.accent.primary}
        />
        <WorkoutSummaryStatRow
          icon={TrendingUp}
          label="Personal Records"
          value={personalRecords}
          iconBgColor="rgba(251, 191, 36, 0.1)"
          iconColor="#fbbf24"
          showDivider={false}
          showStarIcon={true}
        />
      </View>
    </View>
  );
}
