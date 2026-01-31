import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../theme/Button';

interface DailySummaryEmptyStateProps {
  onSetGoals?: () => void;
}

export const DailySummaryEmptyState: React.FC<DailySummaryEmptyStateProps> = ({
  onSetGoals,
}) => {
  return (
    <View className="relative flex min-h-[170px] flex-col justify-between overflow-hidden rounded-2xl">
      {/* Background gradient */}
      <LinearGradient
        colors={['#4f46e5', '#29e08e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      {/* Pattern overlay */}
      <View
        className="absolute inset-0 opacity-10"
        style={{
          backgroundColor: 'transparent',
        }}
      />

      {/* Content */}
      <View className="relative z-10 flex h-full flex-col gap-4 p-5">
        {/* Header */}
        <View className="flex items-center justify-between">
          <Text
            className="text-[10px] font-medium uppercase tracking-wider"
            style={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            Daily Summary
          </Text>
        </View>

        {/* Center content */}
        <View className="flex flex-1 flex-col items-center justify-center gap-4 py-1">
          <Text
            className="text-center text-sm font-medium"
            style={{ color: 'rgba(255, 255, 255, 0.9)' }}
          >
            Set your nutrition goals to track your progress.
          </Text>

          <Button
            label={"Set Goals"}
            variant="accent"
            size="sm"
            width="full"
            onPress={() => {}}
          />
        </View>
      </View>
    </View>
  );
};