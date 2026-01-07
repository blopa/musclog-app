import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, Image } from 'react-native';
import { ArrowLeft, Share2, Check, Weight, Dumbbell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type SetData = {
  setNumber: number;
  weight: number;
  reps: number;
  partials: number;
  isCurrent?: boolean;
};

type ExerciseData = {
  id: string;
  name: string;
  time: string;
  exerciseNumber: number;
  image?: any;
  sets: SetData[];
  setProgress?: number[]; // Progress percentage for each set (0-100)
};

type WorkoutHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  exerciseName?: string;
  workoutName?: string;
  duration?: string;
  totalVolume?: number;
  totalSets?: number;
  exercises?: ExerciseData[];
};

// Mock data - replace with actual data from props or state
const MOCK_EXERCISES: ExerciseData[] = [
  {
    id: '1',
    name: 'Incline Dumbbell Press',
    time: '10:15 AM',
    exerciseNumber: 1,
    sets: [
      { setNumber: 1, weight: 24, reps: 12, partials: 0 },
      { setNumber: 2, weight: 26, reps: 10, partials: 0 },
      { setNumber: 3, weight: 26, reps: 8, partials: 3, isCurrent: true },
    ],
    setProgress: [80, 90, 100],
  },
  {
    id: '2',
    name: 'Lateral Raises',
    time: '10:28 AM',
    exerciseNumber: 2,
    sets: [
      { setNumber: 1, weight: 12, reps: 15, partials: 0 },
      { setNumber: 2, weight: 12, reps: 14, partials: 4 },
      { setNumber: 3, weight: 12, reps: 12, partials: 5 },
    ],
    setProgress: [100, 100, 100],
  },
  {
    id: '3',
    name: 'Machine Chest Fly',
    time: '10:45 AM',
    exerciseNumber: 3,
    sets: [
      { setNumber: 1, weight: 54, reps: 15, partials: 0 },
      { setNumber: 2, weight: 59, reps: 12, partials: 3 },
    ],
    setProgress: [100, 100],
  },
];

function SetRow({ set }: { set: SetData; isLast: boolean }) {
  const isCurrent = set.isCurrent;

  return (
    <View
      className="flex-row items-center rounded py-1.5"
      style={{
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: isCurrent ? `${theme.colors.accent.primary}1A` : 'transparent',
        borderWidth: isCurrent ? 1 : 0,
        borderColor: isCurrent ? `${theme.colors.accent.primary}33` : 'transparent',
      }}>
      {/* Set Number */}
      <View className="w-8 items-center">
        <View
          className="h-5 w-5 items-center justify-center rounded-full"
          style={{
            backgroundColor: isCurrent
              ? theme.colors.accent.primary
              : theme.colors.background.overlay,
          }}>
          <Text
            className="text-[10px] font-bold"
            style={{
              color: isCurrent ? theme.colors.text.black : theme.colors.text.secondary,
            }}>
            {set.setNumber}
          </Text>
        </View>
      </View>

      {/* Weight */}
      <View className="flex-1 items-center">
        <Text
          className="text-sm font-bold tabular-nums"
          style={{
            color: isCurrent ? theme.colors.text.primary : theme.colors.text.secondary,
          }}>
          {set.weight}
        </Text>
      </View>

      {/* Reps */}
      <View className="flex-1 items-center">
        <Text
          className="text-sm font-bold tabular-nums"
          style={{
            color: isCurrent ? theme.colors.text.primary : theme.colors.text.secondary,
          }}>
          {set.reps}
        </Text>
      </View>

      {/* Partials */}
      <View className="flex-1 items-center">
        <Text
          className="text-xs tabular-nums"
          style={{
            color: set.partials > 0 ? theme.colors.accent.primary : theme.colors.text.tertiary,
            fontWeight: set.partials > 0 ? 'bold' : 'normal',
          }}>
          {set.partials > 0 ? `+${set.partials}` : '-'}
        </Text>
      </View>
    </View>
  );
}

function ExerciseItem({ exercise, isLast }: { exercise: ExerciseData; isLast: boolean }) {
  const { t } = useTranslation();
  const hasCurrentSet = exercise.sets.some((set) => set.isCurrent);

  return (
    <View className="relative mb-6">
      {/* Timeline line */}
      {!isLast && (
        <View
          className="absolute bottom-[-24px] left-[19px] top-12 w-0.5"
          style={{ backgroundColor: theme.colors.border.light }}
        />
      )}

      {/* Exercise Header */}
      <View className="relative z-10 mb-3 flex-row items-center gap-3">
        {/* Checkmark Icon */}
        <View
          className="h-10 w-10 shrink-0 items-center justify-center rounded-full border-2"
          style={{
            borderColor: hasCurrentSet ? theme.colors.accent.primary : theme.colors.border.light,
            backgroundColor: theme.colors.background.primary,
          }}>
          <Check
            size={20}
            color={hasCurrentSet ? theme.colors.accent.primary : theme.colors.text.tertiary}
          />
        </View>

        {/* Exercise Info */}
        <View className="flex-1">
          <View className="mb-1 flex-row items-center gap-2">
            <Text className="text-xs font-bold uppercase text-text-secondary">{exercise.time}</Text>
            <View className="h-1 w-1 rounded-full bg-gray-300" />
            <Text className="text-xs font-medium text-text-secondary">
              {t('workoutHistory.exercise', { number: exercise.exerciseNumber })}
            </Text>
          </View>
          <Text className="text-base font-bold text-text-primary">{exercise.name}</Text>
        </View>

        {/* Exercise Image */}
        {exercise.image && (
          <View className="h-8 w-8 overflow-hidden rounded-lg border border-border-light">
            <Image source={exercise.image} className="h-full w-full" resizeMode="cover" />
          </View>
        )}
      </View>

      {/* Sets Table */}
      <View className="ml-5 pl-8">
        <View
          className="overflow-hidden rounded-xl border"
          style={{
            backgroundColor: theme.colors.background.card,
            borderColor: theme.colors.border.accent,
          }}>
          {/* Table Header */}
          <View
            className="flex-row border-b"
            style={{
              borderBottomColor: theme.colors.border.light,
              backgroundColor: `${theme.colors.background.white}08`,
            }}>
            <View className="w-8 items-center py-2">
              <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                #
              </Text>
            </View>
            <View className="flex-1 items-center py-2">
              <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {t('workoutSession.kg')}
              </Text>
            </View>
            <View className="flex-1 items-center py-2">
              <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {t('workoutSession.reps')}
              </Text>
            </View>
            <View className="flex-1 items-center py-2">
              <Text
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: theme.colors.accent.primary }}>
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
          {exercise.setProgress && exercise.setProgress.length > 0 && (
            <View
              className="flex-row items-end gap-1 border-t px-4 pb-3 pt-1"
              style={{
                borderTopColor: theme.colors.border.light,
                height: 48,
              }}>
              {exercise.setProgress.map((progress, index) => {
                const isCurrent = exercise.sets[index]?.isCurrent;
                return (
                  <View key={index} className="flex-1 gap-1">
                    <View
                      className="h-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: theme.colors.background.gray800 }}>
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
                      className="text-[10px]"
                      style={{
                        color: isCurrent ? theme.colors.accent.primary : theme.colors.text.tertiary,
                        fontWeight: isCurrent ? 'bold' : 'normal',
                      }}>
                      {t('workoutHistory.set', { number: index + 1 })}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export function WorkoutHistoryModal({
  visible,
  onClose,
  exerciseName,
  workoutName = 'Push & Shoulders',
  duration = '00:45',
  totalVolume = 3450,
  totalSets = 12,
  exercises = MOCK_EXERCISES,
}: WorkoutHistoryModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View className="flex-1 bg-bg-primary">
        {/* Header */}
        <View className="flex-row items-center gap-4 border-b border-border-light bg-bg-primary px-4 py-4">
          <Pressable className="-ml-2 rounded-full p-2" onPress={onClose}>
            <ArrowLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold tracking-tight text-text-primary">
              {t('workoutHistory.title')}
            </Text>
          </View>
          <Pressable className="-mr-2 rounded-full p-2">
            <Share2 size={theme.iconSize.md} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-6 px-4 pb-8 pt-4">
            {/* Workout Summary */}
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text
                    className="mb-0.5 block text-xs font-bold uppercase tracking-wider"
                    style={{ color: theme.colors.accent.primary }}>
                    {t('workoutHistory.workoutInProgress')}
                  </Text>
                  <Text className="text-2xl font-bold leading-tight text-text-primary">
                    {workoutName}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-mono text-2xl font-bold tabular-nums tracking-tight text-text-primary">
                    {duration}
                  </Text>
                  <Text className="text-xs font-medium text-text-secondary">
                    {t('workoutHistory.duration')}
                  </Text>
                </View>
              </View>

              {/* Stats Pills */}
              <View className="mt-1 flex-row items-center gap-3">
                <View
                  className="flex-row items-center gap-1.5 rounded-lg px-3 py-1.5"
                  style={{ backgroundColor: `${theme.colors.status.info}33` }}>
                  <Weight size={16} color={theme.colors.status.info} />
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: theme.colors.status.info }}>
                    {totalVolume.toLocaleString()}kg {t('workoutHistory.volume')}
                  </Text>
                </View>
                <View
                  className="flex-row items-center gap-1.5 rounded-lg px-3 py-1.5"
                  style={{ backgroundColor: `${theme.colors.background.white}0D` }}>
                  <Dumbbell size={16} color={theme.colors.text.secondary} />
                  <Text className="text-xs font-semibold text-text-secondary">
                    {totalSets} {t('workoutHistory.setsDone')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View className="h-px" style={{ backgroundColor: theme.colors.border.light }} />

            {/* Exercises List */}
            <View className="flex-col gap-3">
              {exercises.map((exercise, index) => (
                <ExerciseItem
                  key={exercise.id}
                  exercise={exercise}
                  isLast={index === exercises.length - 1}
                />
              ))}
            </View>

            {/* Bottom spacing */}
            <View className="h-8" />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
