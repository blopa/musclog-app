import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import { theme } from '../theme';
import { CurrentGoalsCard } from './cards/CurrentGoalsCard';
import { GoalHistoryCard } from './cards/GoalHistoryCard';
import { FullScreenModal } from './modals/FullScreenModal';
import { NutritionGoalsModal } from './modals/NutritionGoalsModal';
import { Button } from './theme/Button';

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

type GoalsManagementModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function GoalsManagementModal({ visible, onClose }: GoalsManagementModalProps) {
  const { t } = useTranslation();
  const [nutritionGoalsModalVisible, setNutritionGoalsModalVisible] = useState(false);

  const handleNewGoal = () => {
    setNutritionGoalsModalVisible(true);
  };

  const handleCloseNutritionGoalsModal = () => {
    setNutritionGoalsModalVisible(false);
  };

  const handleSaveNutritionGoals = () => {
    // TODO: Handle saving nutrition goals
    // This could update the current goal or add to history
    setNutritionGoalsModalVisible(false);
  };

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('goalsManagement.title')}
        headerRight={
          <Button
            label={t('goalsManagement.newGoal')}
            icon={Plus}
            iconPosition="left"
            variant="gradientCta"
            size="sm"
            onPress={handleNewGoal}
          />
        }
        scrollable={false}>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="shrink-0 px-6 pb-6" />
          {/* Scrollable content */}
          <View className="flex-1 px-6 pb-32">
            {/* Current Goals Section */}
            <View className="mb-8">
              <View className="mb-3 flex-row items-center justify-between">
                <Text
                  className="font-bold uppercase tracking-widest text-text-secondary"
                  style={{ fontSize: theme.typography.fontSize.xs }}>
                  {t('goalsManagement.currentGoals')}
                </Text>
                <View
                  className="rounded-full border px-2"
                  style={{
                    backgroundColor: theme.colors.accent.primary10,
                    borderColor: theme.colors.accent.primary20,
                    paddingVertical: theme.spacing.padding.xsHalf,
                  }}>
                  <Text
                    className="font-bold text-accent-primary"
                    style={{ fontSize: theme.typography.fontSize.xs }}>
                    {t('goalsManagement.active')}
                  </Text>
                </View>
              </View>

              {/* Current Goal Card */}
              <CurrentGoalsCard goal={currentGoal} />
            </View>

            {/* Goals History Section */}
            <View className="mb-6">
              <Text
                className="mb-6 font-bold uppercase tracking-widest text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.xs }}>
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
          <View style={{ height: theme.size['24'] }} />
        </ScrollView>
      </FullScreenModal>

      <NutritionGoalsModal
        visible={nutritionGoalsModalVisible}
        onClose={handleCloseNutritionGoalsModal}
        onSave={handleSaveNutritionGoals}
      />
    </>
  );
}
