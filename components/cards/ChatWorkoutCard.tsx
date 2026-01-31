import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Dumbbell, Flame } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ImageSourcePropType, Pressable, Text, View } from 'react-native';

import { theme } from '../../theme';
import { GenericCard } from './GenericCard';

type ChatWorkoutCardProps = {
  title: string;
  duration: string;
  level: string;
  exerciseCount: number;
  calories: number;
  image: ImageSourcePropType | { uri: string };
  onStartWorkout?: () => void;
};

export function ChatWorkoutCard({
  title,
  duration,
  level,
  exerciseCount,
  calories,
  image,
  onStartWorkout,
}: ChatWorkoutCardProps) {
  const { t } = useTranslation();
  return (
    <GenericCard variant="card" size="sm">
      {/* Hero Image Section */}
      <View className="relative h-32">
        <Image source={image} className="h-full w-full" resizeMode="cover" />
        <LinearGradient
          colors={['transparent', theme.colors.background.black80]}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        <View className="absolute bottom-3 left-4">
          <Text className="mb-1 text-lg font-bold text-white">{title}</Text>
          <Text className="text-sm font-medium" style={{ color: theme.colors.accent.primary }}>
            {duration} • {level}
          </Text>
        </View>
      </View>

      {/* Content Section */}
      <View className="p-4">
        {/* Stats Row */}
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <Dumbbell size={theme.iconSize.sm} color={theme.colors.text.secondary} />
            <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
              {exerciseCount} {t('workouts.exercises')}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Flame size={theme.iconSize.sm} color={theme.colors.text.secondary} />
            <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
              {calories} {t('common.kcal')}
            </Text>
          </View>
        </View>

        {/* Start Workout Button */}
        <Pressable
          className="w-full flex-row items-center justify-center gap-2 rounded-lg py-2.5 active:scale-95"
          style={{ backgroundColor: theme.colors.accent.primary }}
          onPress={onStartWorkout}
        >
          <Text className="font-bold" style={{ color: theme.colors.text.black }}>
            {t('startWorkout.label')}
          </Text>
          <ArrowRight size={theme.iconSize.md} color={theme.colors.text.black} />
        </Pressable>
      </View>
    </GenericCard>
  );
}
