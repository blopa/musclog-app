import React from 'react';
import { View, Text } from 'react-native';
import { History } from 'lucide-react-native';
import { theme } from '../../theme';
import { GenericCard } from './GenericCard';

type GoalType = 'cutting' | 'maintenance' | 'bulking' | 'lean-bulk';

const goalTypeStyles: Record<GoalType, { label: string }> = {
  cutting: {
    label: 'CUTTING',
  },
  maintenance: {
    label: 'MAINTENANCE',
  },
  bulking: {
    label: 'BULKING',
  },
  'lean-bulk': {
    label: 'LEAN BULK',
  },
};

interface GoalHistoryItem {
  id: number;
  dateRange: string;
  type: GoalType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight: number;
  bodyFat: number;
}

interface GoalHistoryCardProps {
  goal: GoalHistoryItem;
  isLast?: boolean;
}

export function GoalHistoryCard({ goal, isLast = false }: GoalHistoryCardProps) {
  const styles = goalTypeStyles[goal.type];

  return (
    <View className="relative mb-6 flex-row gap-4">
      {/* Timeline line */}
      {!isLast && (
        <View
          className="absolute left-[19px] top-10"
          style={{
            bottom: -24,
            width: 0.5,
            backgroundColor: theme.colors.border.emerald,
          }}
        />
      )}

      {/* Timeline dot */}
      <View
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-bg-card"
        style={{ borderColor: theme.colors.border.emerald }}>
        <History size={theme.iconSize.lg} color={theme.colors.text.secondary} />
      </View>

      {/* Content */}
      <View className="flex-1 pb-2">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-text-secondary">{goal.dateRange}</Text>
          <View
            className="rounded border px-2 py-0.5 uppercase"
            style={{
              backgroundColor:
                goal.type === 'cutting'
                  ? theme.colors.status.amber10
                  : goal.type === 'maintenance'
                    ? theme.colors.status.indigo10
                    : goal.type === 'bulking'
                      ? theme.colors.status.indigo10
                      : theme.colors.accent.primary10,
              borderColor:
                goal.type === 'cutting'
                  ? theme.colors.status.amber10
                  : goal.type === 'maintenance'
                    ? theme.colors.status.indigo20
                    : goal.type === 'bulking'
                      ? theme.colors.status.indigo20
                      : theme.colors.accent.primary20,
            }}>
            <Text
              className="text-[9px] font-bold"
              style={{
                color:
                  goal.type === 'cutting'
                    ? theme.colors.status.amber
                    : goal.type === 'maintenance'
                      ? theme.colors.status.indigoLight
                      : goal.type === 'bulking'
                        ? theme.colors.status.indigoLight
                        : theme.colors.accent.primary,
              }}>
              {styles.label}
            </Text>
          </View>
        </View>

        <GenericCard variant="card">
          <View className="p-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-col">
                <Text className="text-lg font-bold text-text-primary">
                  {goal.calories.toLocaleString()}{' '}
                  <Text className="text-[10px] font-normal text-text-secondary">KCAL</Text>
                </Text>
                <Text className="text-[10px] text-text-secondary">
                  P:{goal.protein}g • C:{goal.carbs}g • F:{goal.fat}g
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs font-bold text-text-secondary">{goal.weight} kg</Text>
                <Text className="text-[10px] text-text-secondary">{goal.bodyFat}% BF</Text>
              </View>
            </View>
          </View>
        </GenericCard>
      </View>
    </View>
  );
}
