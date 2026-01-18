import React from 'react';
import { View, Text } from 'react-native';
import { Scale, Percent, Activity, Calculator, Calendar } from 'lucide-react-native';
import { theme } from '../../theme';
import { GenericCard } from './GenericCard';
import { GoalTypeBadge } from '../GoalTypeBadge';

type GoalType = 'cutting' | 'maintenance' | 'bulking' | 'lean-bulk';

interface CurrentGoal {
  type: GoalType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetWeight?: number;
  bodyFat?: number;
  ffmi?: number;
  bmi?: number;
  goalDate?: string;
}

interface CurrentGoalsCardProps {
  goal: CurrentGoal;
}

export function CurrentGoalsCard({ goal }: CurrentGoalsCardProps) {
  return (
    <GenericCard variant="card">
      <View className="relative p-5">
        {/* Goal Type Badge */}
        <View className="absolute right-0 top-0 p-4">
          <GoalTypeBadge type={goal.type} variant="default" showBorder={false} />
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

      {/* Goal Date */}
      {goal.goalDate && (
        <View className="mt-4">
          <View className="flex-row items-center gap-2">
            <Calendar size={theme.iconSize.md} color={theme.colors.text.secondary} />
            <Text className="text-xs font-semibold text-text-secondary">{goal.goalDate}</Text>
          </View>
        </View>
      )}

      {/* Target Metrics */}
      {(goal.targetWeight !== undefined ||
        goal.bodyFat !== undefined ||
        goal.ffmi !== undefined ||
        goal.bmi !== undefined) && (
        <View
          className="mt-4 flex-row flex-wrap gap-4 rounded-lg p-3"
          style={{ backgroundColor: theme.colors.background.darkGreen50 }}>
          {goal.targetWeight !== undefined && (
            <View className="flex-1 min-w-[45%] flex-row items-center gap-3">
              <Scale size={theme.iconSize.lg} color={theme.colors.accent.primary} />
              <View>
                <Text className="text-[9px] font-bold uppercase text-text-secondary">
                  Target Weight
                </Text>
                <Text className="text-sm font-bold text-text-primary">
                  {goal.targetWeight}{' '}
                  <Text className="text-[10px] text-text-secondary">kg</Text>
                </Text>
              </View>
            </View>
          )}
          {goal.bodyFat !== undefined && (
            <View className="flex-1 min-w-[45%] flex-row items-center gap-3">
              <Percent size={theme.iconSize.lg} color={theme.colors.accent.primary} />
              <View>
                <Text className="text-[9px] font-bold uppercase text-text-secondary">Body Fat</Text>
                <Text className="text-sm font-bold text-text-primary">
                  {goal.bodyFat}{' '}
                  <Text className="text-[10px] text-text-secondary">%</Text>
                </Text>
              </View>
            </View>
          )}
          {goal.ffmi !== undefined && (
            <View className="flex-1 min-w-[45%] flex-row items-center gap-3">
              <Activity size={theme.iconSize.lg} color={theme.colors.accent.primary} />
              <View>
                <Text className="text-[9px] font-bold uppercase text-text-secondary">FFMI</Text>
                <Text className="text-sm font-bold text-text-primary">
                  {goal.ffmi.toFixed(1)}
                </Text>
              </View>
            </View>
          )}
          {goal.bmi !== undefined && (
            <View className="flex-1 min-w-[45%] flex-row items-center gap-3">
              <Calculator size={theme.iconSize.lg} color={theme.colors.accent.primary} />
              <View>
                <Text className="text-[9px] font-bold uppercase text-text-secondary">BMI</Text>
                <Text className="text-sm font-bold text-text-primary">
                  {goal.bmi.toFixed(1)}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
      </View>
    </GenericCard>
  );
}
