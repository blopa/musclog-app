import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Scale, Percent, History } from 'lucide-react-native';
import { MasterLayout } from '../components/MasterLayout';
import { theme } from '../theme';
import { CurrentGoalsCard } from '../components/cards/CurrentGoalsCard';

type GoalType = 'cutting' | 'maintenance' | 'bulking' | 'lean-bulk';

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
  targetWeight?: number;
  bodyFat?: number;
  ffmi?: number;
  bmi?: number;
  goalDate?: string;
}

const goalsHistory: GoalHistoryItem[] = [
  {
    id: 1,
    dateRange: 'Mar 16 - May 22, 2023',
    type: 'cutting',
    calories: 2100,
    protein: 180,
    carbs: 190,
    fat: 65,
    weight: 74.5,
    bodyFat: 11,
  },
  {
    id: 2,
    dateRange: 'Jan 01 - Mar 15, 2023',
    type: 'maintenance',
    calories: 2450,
    protein: 175,
    carbs: 280,
    fat: 70,
    weight: 78.0,
    bodyFat: 13,
  },
  {
    id: 3,
    dateRange: 'Oct 12 - Dec 31, 2022',
    type: 'lean-bulk',
    calories: 2700,
    protein: 170,
    carbs: 350,
    fat: 75,
    weight: 76.0,
    bodyFat: 12.5,
  },
];

const currentGoal: CurrentGoal = {
  type: 'bulking',
  calories: 2850,
  protein: 190,
  carbs: 320,
  fat: 85,
  targetWeight: 82.0,
  bodyFat: 14.0,
  ffmi: 22.5,
  bmi: 24.5,
  goalDate: 'Dec 31, 2024',
};

export default function GoalsManagementPage() {
  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="shrink-0 px-6 pb-6">
          <Text className="text-2xl font-bold tracking-tight text-text-primary">
            Goals Management
          </Text>
          <Text className="mt-1 text-sm text-text-secondary">Track your progress and history.</Text>
        </View>

        {/* Scrollable content */}
        <View className="flex-1 px-6 pb-32">
          {/* Current Goals Section */}
          <View className="mb-8">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                CURRENT GOALS
              </Text>
              <View
                className="rounded-full border px-2 py-0.5"
                style={{
                  backgroundColor: theme.colors.accent.primary10,
                  borderColor: theme.colors.accent.primary20,
                }}>
                <Text className="text-[10px] font-bold text-accent-primary">Active</Text>
              </View>
            </View>

            {/* Current Goal Card */}
            <CurrentGoalsCard goal={currentGoal} />
          </View>

          {/* Goals History Section */}
          <View className="mb-6">
            <Text className="mb-6 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              GOALS HISTORY
            </Text>

            <View>
              {goalsHistory.map((goal, index) => {
                const styles = goalTypeStyles[goal.type];
                const isLast = index === goalsHistory.length - 1;

                return (
                  <View key={goal.id} className="relative mb-6 flex-row gap-4">
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
                        <Text className="text-xs font-semibold text-text-secondary">
                          {goal.dateRange}
                        </Text>
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

                      <View
                        className="border-border rounded-xl border p-3"
                        style={{ backgroundColor: theme.colors.background.card }}>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-col">
                            <Text className="text-lg font-bold text-text-primary">
                              {goal.calories.toLocaleString()}{' '}
                              <Text className="text-[10px] font-normal text-text-secondary">
                                KCAL
                              </Text>
                            </Text>
                            <Text className="text-[10px] text-text-secondary">
                              P:{goal.protein}g • C:{goal.carbs}g • F:{goal.fat}g
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-xs font-bold text-text-secondary">
                              {goal.weight} kg
                            </Text>
                            <Text className="text-[10px] text-text-secondary">
                              {goal.bodyFat}% BF
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Bottom spacing for navigation */}
        <View className="h-24" />
      </ScrollView>
    </MasterLayout>
  );
}
