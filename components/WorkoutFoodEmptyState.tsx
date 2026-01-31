import React from 'react';
import { View, Text } from 'react-native';
import { Dumbbell, Utensils } from 'lucide-react-native';
import { theme } from '../theme';
import { GenericCard } from './cards/GenericCard';
import { Button } from './theme/Button';

type EmptyStateType = 'workout' | 'food';

type WorkoutFoodEmptyStateProps = {
  type: EmptyStateType;
  onButtonPress?: () => void;
};

const getConfig = (type: EmptyStateType) => {
  switch (type) {
    case 'workout':
      return {
        icon: Dumbbell,
        title: 'No workouts yet',
        description: 'Ready for your first session?',
        buttonLabel: 'Plan',
        buttonVariant: 'accent' as const,
      };
    case 'food':
      return {
        icon: Utensils,
        title: 'Nothing logged today',
        description: 'Fuel your body!',
        buttonLabel: 'Log',
        buttonVariant: 'outline' as const,
      };
  }
};

export function WorkoutFoodEmptyState({ type, onButtonPress }: WorkoutFoodEmptyStateProps) {
  const config = getConfig(type);
  const Icon = config.icon;

  return (
    <GenericCard variant="card">
      <View className="flex-row items-center justify-between gap-3 px-4 py-3">
        <View className="flex-1 flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.background.overlay }}
          >
            <Icon size={20} color={theme.colors.text.tertiary} />
          </View>
          <View className="flex-col">
            <Text className="text-sm font-semibold text-text-primary">{config.title}</Text>
            <Text className="text-xs text-text-secondary">{config.description}</Text>
          </View>
        </View>
        <Button
          label={config.buttonLabel}
          onPress={onButtonPress}
          variant={config.buttonVariant}
          size="sm"
          width="auto"
        />
      </View>
    </GenericCard>
  );
}
