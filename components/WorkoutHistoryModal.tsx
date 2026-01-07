import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';

type WorkoutHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  exerciseName: string;
};

type HistoryEntry = {
  id: string;
  date: string;
  weight: number;
  reps: number;
  sets: number;
  rpe?: number;
};

// Mock data - replace with actual data from your state/API
const MOCK_HISTORY: HistoryEntry[] = [
  {
    id: '1',
    date: '2024-01-15',
    weight: 24,
    reps: 10,
    sets: 4,
    rpe: 8,
  },
  {
    id: '2',
    date: '2024-01-12',
    weight: 22,
    reps: 12,
    sets: 4,
    rpe: 7,
  },
  {
    id: '3',
    date: '2024-01-10',
    weight: 22,
    reps: 10,
    sets: 4,
    rpe: 8,
  },
  {
    id: '4',
    date: '2024-01-08',
    weight: 20,
    reps: 12,
    sets: 3,
    rpe: 7,
  },
];

export function WorkoutHistoryModal({
  visible,
  onClose,
  exerciseName,
}: WorkoutHistoryModalProps) {
  const { t } = useTranslation();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('workoutSession.history')}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: theme.spacing.padding['2xl'],
        }}>
        <View className="mb-4">
          <Text
            className="mb-2 text-text-secondary"
            style={{ fontSize: theme.typography.fontSize.sm }}>
            {exerciseName}
          </Text>
        </View>

        <View className="gap-3">
          {MOCK_HISTORY.map((entry) => (
            <View
              key={entry.id}
              className="rounded-xl border border-border-accent bg-bg-overlay"
              style={{
                padding: theme.spacing.padding.base,
                ...theme.shadows.sm,
              }}>
              <View className="mb-2 flex-row items-center justify-between">
                <Text
                  className="font-semibold text-text-primary"
                  style={{ fontSize: theme.typography.fontSize.base }}>
                  {formatDate(entry.date)}
                </Text>
                {entry.rpe && (
                  <View
                    className="rounded-full px-2 py-1"
                    style={{
                      backgroundColor: `${theme.colors.accent.primary}33`,
                    }}>
                    <Text
                      style={{
                        fontSize: theme.typography.fontSize.xs,
                        fontWeight: theme.typography.fontWeight.semibold,
                        color: theme.colors.accent.primary,
                      }}>
                      RPE {entry.rpe}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text
                    className="mb-1 text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xs }}>
                    {t('workoutSession.weight')}
                  </Text>
                  <Text
                    className="font-bold text-text-primary"
                    style={{ fontSize: theme.typography.fontSize.lg }}>
                    {entry.weight} {t('workoutSession.kg')}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    className="mb-1 text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xs }}>
                    {t('workoutSession.reps')}
                  </Text>
                  <Text
                    className="font-bold text-text-primary"
                    style={{ fontSize: theme.typography.fontSize.lg }}>
                    {entry.reps}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    className="mb-1 text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xs }}>
                    Sets
                  </Text>
                  <Text
                    className="font-bold text-text-primary"
                    style={{ fontSize: theme.typography.fontSize.lg }}>
                    {entry.sets}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </FullScreenModal>
  );
}

