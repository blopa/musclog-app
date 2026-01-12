import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Share2, Weight, Dumbbell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { ExerciseItem, ExerciseData } from '../WorkoutHistoryExerciseItem';
import { FullScreenModal } from './FullScreenModal';

export type { SetData } from '../WorkoutHistorySetRow';

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
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('workoutHistory.title')}
      headerRight={
        <Pressable className="rounded-full p-2">
          <Share2 size={theme.iconSize.md} color={theme.colors.text.secondary} />
        </Pressable>
      }>
      <View className="gap-6 px-4 pb-8 pt-4">
        {/* Workout Summary */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text
                className="mb-0.5 block text-sm font-bold uppercase tracking-wider"
                style={{ color: theme.colors.accent.primary }}>
                {t('workoutHistory.workoutInProgress')}
              </Text>
              <Text className="text-3xl font-bold leading-tight text-text-primary">
                {workoutName}
              </Text>
            </View>
            <View className="items-end">
              <Text className="font-mono text-3xl font-bold tabular-nums tracking-tight text-text-primary">
                {duration}
              </Text>
              <Text className="text-sm font-medium text-text-secondary">
                {t('workoutHistory.duration')}
              </Text>
            </View>
          </View>

          {/* Stats Pills */}
          <View className="mt-1 flex-row items-center gap-3">
            <View
              className="flex-row items-center gap-1.5 rounded-lg px-3 py-1.5"
              style={{ backgroundColor: theme.colors.status.info20 }}>
              <Weight size={theme.iconSize.md} color={theme.colors.status.info} />
              <Text className="text-sm font-semibold" style={{ color: theme.colors.status.info }}>
                {totalVolume.toLocaleString()}kg {t('workoutHistory.volume')}
              </Text>
            </View>
            <View
              className="flex-row items-center gap-1.5 rounded-lg px-3 py-1.5"
              style={{ backgroundColor: theme.colors.background.white5 }}>
              <Dumbbell size={theme.iconSize.md} color={theme.colors.text.secondary} />
              <Text className="text-sm font-semibold text-text-secondary">
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
    </FullScreenModal>
  );
}
