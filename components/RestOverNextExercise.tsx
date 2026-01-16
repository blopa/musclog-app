import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type RestOverNextExerciseProps = {
  exercise: {
    name: string;
    weight: string;
    reps: number;
    set: number;
    totalSets: number;
  };
};

export function RestOverNextExercise({ exercise }: RestOverNextExerciseProps) {
  const { t } = useTranslation();

  return (
    <View
      className="mt-4 w-full max-w-sm rounded-xl border p-5"
      style={{
        backgroundColor: theme.colors.background.darkGreen50,
        borderColor: theme.colors.background.white5,
        ...theme.shadows.lg,
      }}>
      <View className="mb-3 flex-row items-center gap-3">
        <View
          className="h-10 w-1 rounded-full"
          style={{ backgroundColor: theme.colors.accent.primary }}
        />
        <View className="flex-1">
          <Text className="text-xs font-bold uppercase tracking-widest text-accent-primary opacity-80">
            {t('restOver.upNext')}
          </Text>
          <Text className="text-xl font-bold text-white">{exercise.name}</Text>
        </View>
      </View>
      <View className="flex-row items-center justify-between border-t border-white/10 pt-3">
        <View className="flex-col items-start">
          <Text
            className="font-bold uppercase text-white/40"
            style={{ fontSize: theme.typography.fontSize.xs }}>
            {t('restOver.weight')}
          </Text>
          <Text className="text-base font-bold text-white">{exercise.weight}</Text>
        </View>
        <View className="flex-col items-start">
          <Text
            className="font-bold uppercase text-white/40"
            style={{ fontSize: theme.typography.fontSize.xs }}>
            {t('restOver.reps')}
          </Text>
          <Text className="text-base font-bold text-white">{exercise.reps}</Text>
        </View>
        <View className="flex-col items-start">
          <Text
            className="font-bold uppercase text-white/40"
            style={{ fontSize: theme.typography.fontSize.xs }}>
            {t('restOver.set')}
          </Text>
          <Text className="text-base font-bold text-white">
            {exercise.set}
            <Text className="font-normal text-white/40">/{exercise.totalSets}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}
