import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Scale, Percent, History } from 'lucide-react-native';
import { MasterLayout } from '../components/MasterLayout';
import { theme } from '../theme';

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

export default function GoalsManagementPage() {
  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pb-6 shrink-0">
          <Text className="text-text-primary text-2xl font-bold tracking-tight">
            Goals Management
          </Text>
          <Text className="text-text-secondary text-sm mt-1">
            Track your progress and history.
          </Text>
        </View>

        {/* Scrollable content */}
        <View className="flex-1 px-6 pb-32">
          {/* Current Goals Section */}
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-widest">
                CURRENT GOALS
              </Text>
              <View
                className="px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: theme.colors.accent.primary10,
                  borderColor: theme.colors.accent.primary20,
                }}>
                <Text className="text-accent-primary text-[10px] font-bold">Active</Text>
              </View>
            </View>

            {/* Current Goal Card */}
            <View
              className="bg-bg-card rounded-xl p-5 relative overflow-hidden border"
              style={{ borderColor: theme.colors.border.emerald }}>
              {/* Bulking Badge */}
              <View className="absolute top-0 right-0 p-4">
                <View
                  className="bg-indigo-400/10 px-2 py-1 rounded"
                  style={{ backgroundColor: theme.colors.status.indigo10 }}>
                  <Text
                    className="text-[10px] font-bold uppercase"
                    style={{ color: theme.colors.status.indigoLight }}>
                    Bulking
                  </Text>
                </View>
              </View>

              {/* Daily Target */}
              <View className="mb-6">
                <Text className="text-text-secondary text-[10px] font-medium uppercase tracking-wider mb-1">
                  Daily Target
                </Text>
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-4xl font-extrabold tracking-tighter text-text-primary">
                    2,850
                  </Text>
                  <Text className="text-accent-primary text-sm font-bold uppercase">kcal</Text>
                </View>
              </View>

              {/* Macros Grid */}
              <View className="flex-row gap-4 border-t border-border pt-4">
                <View className="flex-1">
                  <Text className="text-text-secondary text-[9px] font-bold uppercase">Protein</Text>
                  <Text className="text-text-primary font-bold">
                    190<Text className="text-[10px] ml-0.5 text-text-secondary">g</Text>
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-text-secondary text-[9px] font-bold uppercase">Carbs</Text>
                  <Text className="text-text-primary font-bold">
                    320<Text className="text-[10px] ml-0.5 text-text-secondary">g</Text>
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-text-secondary text-[9px] font-bold uppercase">Fats</Text>
                  <Text className="text-text-primary font-bold">
                    85<Text className="text-[10px] ml-0.5 text-text-secondary">g</Text>
                  </Text>
                </View>
              </View>

              {/* Target Weight & Body Fat */}
              <View
                className="flex-row gap-4 mt-4 p-3 rounded-lg"
                style={{ backgroundColor: theme.colors.background.darkGreen50 }}>
                <View className="flex-1 flex-row items-center gap-3">
                  <Scale size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                  <View>
                    <Text className="text-text-secondary text-[9px] font-bold uppercase">
                      Target Weight
                    </Text>
                    <Text className="text-text-primary text-sm font-bold">
                      82.0 <Text className="text-[10px] text-text-secondary">kg</Text>
                    </Text>
                  </View>
                </View>
                <View className="flex-1 flex-row items-center gap-3">
                  <Percent size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                  <View>
                    <Text className="text-text-secondary text-[9px] font-bold uppercase">
                      Body Fat
                    </Text>
                    <Text className="text-text-primary text-sm font-bold">
                      14.0 <Text className="text-[10px] text-text-secondary">%</Text>
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Goals History Section */}
          <View className="mb-6">
            <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-widest mb-6">
              GOALS HISTORY
            </Text>

            <View>
              {goalsHistory.map((goal, index) => {
                const styles = goalTypeStyles[goal.type];
                const isLast = index === goalsHistory.length - 1;

                return (
                  <View key={goal.id} className="relative flex-row gap-4 mb-6">
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
                      className="relative z-10 w-10 h-10 rounded-full bg-bg-card border flex items-center justify-center shrink-0"
                      style={{ borderColor: theme.colors.border.emerald }}>
                      <History size={theme.iconSize.lg} color={theme.colors.text.secondary} />
                    </View>

                    {/* Content */}
                    <View className="flex-1 pb-2">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs font-semibold text-text-secondary">
                          {goal.dateRange}
                        </Text>
                        <View
                          className="px-2 py-0.5 rounded border uppercase"
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
                        className="border border-border rounded-xl p-3"
                        style={{ backgroundColor: theme.colors.background.card }}>
                        <View className="flex-row justify-between items-center">
                          <View className="flex-col">
                            <Text className="text-lg font-bold text-text-primary">
                              {goal.calories.toLocaleString()}{' '}
                              <Text className="text-[10px] text-text-secondary font-normal">
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
