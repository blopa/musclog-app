import React from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { ArrowLeft, Share2, Weight, Dumbbell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { ExerciseItem, ExerciseData } from './WorkoutHistoryExerciseItem';

export type { SetData } from './WorkoutHistorySetRow';

export type WorkoutHistoryModalProps = {
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
