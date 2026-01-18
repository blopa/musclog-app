import React from 'react';
import { View, Text } from 'react-native';
import { Scale, Percent } from 'lucide-react-native';
import { theme } from '../../theme';

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

interface CurrentGoal {
  type: GoalType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetWeight: number;
  bodyFat: number;
}

interface CurrentGoalsCardProps {
  goal: CurrentGoal;
}

export function CurrentGoalsCard({ goal }: CurrentGoalsCardProps) {
  return (
    <View
      className="relative overflow-hidden rounded-xl border bg-bg-card p-5"
      style={{ borderColor: theme.colors.border.emerald }}>
      {/* Goal Type Badge */}
      <View className="absolute right-0 top-0 p-4">
        <View
          className="rounded px-2 py-1"
          style={{
            backgroundColor:
              goal.type === 'cutting'
                ? theme.colors.status.amber10
                : goal.type === 'maintenance'
                  ? theme.colors.status.indigo10
                  : goal.type === 'bulking'
                    ? theme.colors.status.indigo10
                    : theme.colors.accent.primary10,
          }}>
          <Text
            className="text-[10px] font-bold uppercase"
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
            {goalTypeStyles[goal.type].label}
          </Text>
        </View>
      </View>

      {/* Daily Target */}
      <View className="mb-6">
        <Text className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-secondary">
          Daily Target
        </Text>
        <View className="flex-row items-baseline gap-1">
          <Text className="text-4xl font-extrabold tracking-tighter text-text-primary">
            {goal.calories.toLocaleString()}
          </Text>
          <Text className="text-sm font-bold uppercase text-accent-primary">kcal</Text>
        </View>
      </View>

      {/* Macros Grid */}
      <View className="border-border flex-row gap-4 border-t pt-4">
        <View className="flex-1">
          <Text className="text-[9px] font-bold uppercase text-text-secondary">Protein</Text>
          <Text className="font-bold text-text-primary">
            {goal.protein}
            <Text className="ml-0.5 text-[10px] text-text-secondary">g</Text>
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-[9px] font-bold uppercase text-text-secondary">Carbs</Text>
          <Text className="font-bold text-text-primary">
            {goal.carbs}
            <Text className="ml-0.5 text-[10px] text-text-secondary">g</Text>
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-[9px] font-bold uppercase text-text-secondary">Fats</Text>
          <Text className="font-bold text-text-primary">
            {goal.fat}
            <Text className="ml-0.5 text-[10px] text-text-secondary">g</Text>
          </Text>
        </View>
      </View>

      {/* Target Weight & Body Fat */}
      <View
        className="mt-4 flex-row gap-4 rounded-lg p-3"
        style={{ backgroundColor: theme.colors.background.darkGreen50 }}>
        <View className="flex-1 flex-row items-center gap-3">
          <Scale size={theme.iconSize.lg} color={theme.colors.accent.primary} />
          <View>
            <Text className="text-[9px] font-bold uppercase text-text-secondary">
              Target Weight
            </Text>
            <Text className="text-sm font-bold text-text-primary">
              {goal.targetWeight} <Text className="text-[10px] text-text-secondary">kg</Text>
            </Text>
          </View>
        </View>
        <View className="flex-1 flex-row items-center gap-3">
          <Percent size={theme.iconSize.lg} color={theme.colors.accent.primary} />
          <View>
            <Text className="text-[9px] font-bold uppercase text-text-secondary">Body Fat</Text>
            <Text className="text-sm font-bold text-text-primary">
              {goal.bodyFat} <Text className="text-[10px] text-text-secondary">%</Text>
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
