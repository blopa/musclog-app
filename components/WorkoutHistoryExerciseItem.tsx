import React from 'react';
import { View, Text, Image } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { SetRow, SetData } from './WorkoutHistorySetRow';

export type ExerciseData = {
  id: string;
  name: string;
  time: string;
  exerciseNumber: number;
  image?: any;
  sets: SetData[];
  setProgress?: number[]; // Progress percentage for each set (0-100)
};

type ExerciseItemProps = {
  exercise: ExerciseData;
  isLast: boolean;
  weightUnitKey?: 'workoutSession.kg' | 'workoutSession.lb';
};

export function ExerciseItem({
  exercise,
  isLast,
  weightUnitKey = 'workoutSession.kg',
}: ExerciseItemProps) {
  const { t } = useTranslation();
  const hasCurrentSet = exercise.sets.some((set) => set.isCurrent);

  return (
    <View className="relative mb-6">
      {/* Timeline line */}
      {!isLast ? (
        <View
          className="absolute top-12 w-0.5"
          style={{
            bottom: -theme.spacing.padding.xl,
            left: theme.spacing.gap.lg,
            backgroundColor: theme.colors.border.light,
          }}
        />
      ) : null}

      {/* Exercise Header */}
      <View className="relative z-10 mb-3 flex-row items-center gap-3">
        {/* Checkmark Icon */}
        <View
          className="h-10 w-10 shrink-0 items-center justify-center rounded-full border-2"
          style={{
            borderColor: hasCurrentSet ? theme.colors.accent.primary : theme.colors.border.light,
            backgroundColor: theme.colors.background.primary,
          }}
        >
          <Check
            size={theme.iconSize.lg}
            color={hasCurrentSet ? theme.colors.accent.primary : theme.colors.text.tertiary}
          />
        </View>

        {/* Exercise Info */}
        <View className="flex-1">
          <View className="mb-1 flex-row items-center gap-2">
            <Text className="text-sm font-bold uppercase text-text-secondary">{exercise.time}</Text>
            <View
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: theme.colors.text.gray300 }}
            />
            <Text className="text-sm font-medium text-text-secondary">
              {t('workoutHistory.exercise', { number: exercise.exerciseNumber })}
            </Text>
          </View>
          <Text className="text-lg font-bold text-text-primary">{exercise.name}</Text>
        </View>

        {/* Exercise Image */}
        {exercise.image ? (
          <View className="h-8 w-8 overflow-hidden rounded-lg border border-border-light">
            <Image source={exercise.image} className="h-full w-full" resizeMode="cover" />
          </View>
        ) : null}
      </View>

      {/* Sets Table */}
      <View className="ml-5 pl-8">
        <View
          className="overflow-hidden rounded-xl border"
          style={{
            backgroundColor: theme.colors.background.card,
            borderColor: theme.colors.border.accent,
          }}
        >
          {/* Table Header */}
          <View
            className="flex-row border-b"
            style={{
              borderBottomColor: theme.colors.border.light,
              backgroundColor: theme.colors.background.white3,
            }}
          >
            <View className="w-8 items-center py-2">
              <Text className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                #
              </Text>
            </View>
            <View className="flex-1 items-center py-2">
              <Text className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                {t(weightUnitKey)}
              </Text>
            </View>
            <View className="flex-1 items-center py-2">
              <Text className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                {t('workoutSession.reps')}
              </Text>
            </View>
            <View className="flex-1 items-center py-2">
              <Text
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: theme.colors.accent.primary }}
              >
                {t('workoutSession.partials')}
              </Text>
            </View>
          </View>

          {/* Sets Rows */}
          <View className="gap-1 p-2">
            {exercise.sets.map((set, index) => (
              <SetRow key={set.setNumber} set={set} isLast={index === exercise.sets.length - 1} />
            ))}
          </View>

          {/* Progress Bars */}
          {exercise.setProgress && exercise.setProgress.length > 0 ? (
            <View
              className="flex-row items-end gap-1 border-t px-4 pb-3 pt-1"
              style={{
                borderTopColor: theme.colors.border.light,
                height: theme.size['12'],
              }}
            >
              {exercise.setProgress.map((progress, index) => {
                const isCurrent = exercise.sets[index]?.isCurrent;
                return (
                  <View key={index} className="flex-1 gap-1">
                    <View
                      className="h-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: theme.colors.background.gray800 }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: isCurrent
                            ? theme.colors.accent.primary
                            : theme.colors.status.info,
                        }}
                      />
                    </View>
                    <Text
                      className="text-xs"
                      style={{
                        color: isCurrent ? theme.colors.accent.primary : theme.colors.text.tertiary,
                        fontWeight: isCurrent ? 'bold' : 'normal',
                      }}
                    >
                      {t('workoutHistory.set', { number: index + 1 })}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
