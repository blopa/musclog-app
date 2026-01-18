import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MasterLayout } from '../components/MasterLayout';
import { theme } from '../theme';
import { CurrentGoalsCard } from '../components/cards/CurrentGoalsCard';
import { GoalHistoryCard } from '../components/cards/GoalHistoryCard';

type EatingPhase = 'cutting' | 'maintenance' | 'bulking' | 'lean-bulk';

interface GoalHistoryItem {
  id: number;
  dateRange: string;
  phase: EatingPhase;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight: number;
  bodyFat: number;
}

interface CurrentGoal {
  phase: EatingPhase;
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
    phase: 'cutting',
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
    phase: 'maintenance',
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
    phase: 'lean-bulk',
    calories: 2700,
    protein: 170,
    carbs: 350,
    fat: 75,
    weight: 76.0,
    bodyFat: 12.5,
  },
];

const currentGoal: CurrentGoal = {
  phase: 'bulking',
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
  const { t } = useTranslation();

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="shrink-0 px-6 pb-6">
          <Text className="text-2xl font-bold tracking-tight text-text-primary">
            {t('goalsManagement.title')}
          </Text>
          <Text className="mt-1 text-sm text-text-secondary">{t('goalsManagement.subtitle')}</Text>
        </View>

        {/* Scrollable content */}
        <View className="flex-1 px-6 pb-32">
          {/* Current Goals Section */}
          <View className="mb-8">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                {t('goalsManagement.currentGoals')}
              </Text>
              <View
                className="rounded-full border px-2 py-0.5"
                style={{
                  backgroundColor: theme.colors.accent.primary10,
                  borderColor: theme.colors.accent.primary20,
                }}>
                <Text className="text-[10px] font-bold text-accent-primary">
                  {t('goalsManagement.active')}
                </Text>
              </View>
            </View>

            {/* Current Goal Card */}
            <CurrentGoalsCard goal={currentGoal} />
          </View>

          {/* Goals History Section */}
          <View className="mb-6">
            <Text className="mb-6 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              {t('goalsManagement.history')}
            </Text>

            <View>
              {goalsHistory.map((goal, index) => {
                const isLast = index === goalsHistory.length - 1;
                return <GoalHistoryCard key={goal.id} goal={goal} isLast={isLast} />;
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
