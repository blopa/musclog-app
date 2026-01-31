import React from 'react';
import { View, Text } from 'react-native';
import { Utensils } from 'lucide-react-native';
import { theme } from '../../theme';
import { GenericCard } from '../cards/GenericCard';
import { Button } from './Button';

type FoodsEmptyStateProps = {
  onLogPress?: () => void;
};

export function FoodsEmptyState({ onLogPress }: FoodsEmptyStateProps) {
  return (
    <GenericCard variant="card">
      <View className="flex-row items-center justify-between gap-3 px-4 py-3">
        <View className="flex-1 flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.background.overlay }}
          >
            <Utensils size={20} color={theme.colors.text.tertiary} />
          </View>
          <View className="flex-col">
            <Text className="text-sm font-semibold text-text-primary">Nothing logged today</Text>
            <Text className="text-xs text-text-secondary">Fuel your body!</Text>
          </View>
        </View>
        <Button label="Log" onPress={onLogPress} variant="outline" size="sm" width="auto" />
      </View>
    </GenericCard>
  );
}
