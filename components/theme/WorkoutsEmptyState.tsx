import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../../theme';
import { GenericCard } from '../cards/GenericCard';
import { Button } from './Button';

type WorkoutsEmptyStateProps = {
  onPlanPress?: () => void;
};

export function WorkoutsEmptyState({ onPlanPress }: WorkoutsEmptyStateProps) {
  return (
    <GenericCard variant="card">
      <View className="flex-row items-center justify-between gap-3 px-4 py-3">
        <View className="flex-1 flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.background.imageLight }}
          >
            <Text style={{ color: theme.colors.text.tertiary }}>🏋️</Text>
          </View>
          <View className="flex-col">
            <Text className="text-sm font-semibold text-text-primary">No workouts yet</Text>
            <Text className="text-xs text-text-secondary">Ready for your first session?</Text>
          </View>
        </View>
        <Button label="Plan" onPress={onPlanPress} variant="accent" size="sm" width="auto" />
      </View>
    </GenericCard>
  );
}
