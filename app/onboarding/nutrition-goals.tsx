import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, ScrollView, Text } from 'react-native';

import { MasterLayout } from '../../components/MasterLayout';
import { NutritionGoalsBody } from '../../components/NutritionGoalsBody';
import { NutritionGoalService } from '../../database/services/NutritionGoalService';
import { useCurrentNutritionGoal } from '../../hooks/useCurrentNutritionGoal';
import { useTheme } from '../../hooks/useTheme';

export default function NutritionGoalsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { readjust } = useLocalSearchParams<{ readjust: string }>();
  const { goal: currentGoal } = useCurrentNutritionGoal();

  const handleSave = async (data: any) => {
    try {
      await NutritionGoalService.saveGoals({
        totalCalories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        fiber: data.fiber,
        eatingPhase: data.eatingPhase,
        targetWeight: data.targetWeight,
        targetBodyFat: data.targetBodyFat,
        targetBMI: data.targetBMI,
        targetFFMI: data.targetFFMI,
        targetDate: data.targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });

      if (readjust === 'true') {
        router.push('/nutrition/checkin');
      } else {
        router.push('/onboarding/complete');
      }
    } catch (error) {
      console.error('Failed to save goals:', error);
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        <Text className="text-3xl font-black text-text-primary mb-6">
          {readjust === 'true' ? t('nutrition.checkin.readjustTitle') : t('onboarding.nutrition_goals.title')}
        </Text>
        <NutritionGoalsBody
            onSave={handleSave}
            initialData={readjust === 'true' && currentGoal ? {
                calories: currentGoal.totalCalories,
                protein: currentGoal.protein,
                carbs: currentGoal.carbs,
                fats: currentGoal.fats,
                fiber: currentGoal.fiber,
                eatingPhase: currentGoal.eatingPhase,
                targetWeight: currentGoal.targetWeight,
                targetBodyFat: currentGoal.targetBodyFat,
                targetBMI: currentGoal.targetBmi,
                targetFFMI: currentGoal.targetFfmi,
            } : undefined}
        />
      </ScrollView>
    </MasterLayout>
  );
}
