import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { MasterLayout } from '../../components/MasterLayout';
import { NutritionGoals, NutritionGoalsBody } from '../../components/NutritionGoalsBody';
import { NutritionGoalService } from '../../database/services';
import { useCurrentNutritionGoal } from '../../hooks/useCurrentNutritionGoal';
import { theme } from '../../theme';
import { showSnackbar } from '../../utils/snackbarService';

export default function NutritionGoalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { goal, isLoading } = useCurrentNutritionGoal();

  // Map goal data to initialGoals format when goal changes
  const initialGoals = useMemo<Partial<NutritionGoals> | undefined>(() => {
    if (!goal) {
      return undefined;
    }
    return {
      totalCalories: goal.totalCalories,
      protein: goal.protein,
      carbs: goal.carbs,
      fats: goal.fats,
      fiber: goal.fiber,
      eatingPhase: goal.eatingPhase as 'cut' | 'maintain' | 'bulk',
      targetWeight: goal.targetWeight,
      targetBodyFat: goal.targetBodyFat,
      targetBMI: goal.targetBmi,
      targetFFMI: goal.targetFfmi,
      targetDate: goal.targetDate ?? null,
    };
  }, [goal]);

  const handleSave = async (goals: NutritionGoals) => {
    try {
      await NutritionGoalService.saveGoals({
        totalCalories: goals.totalCalories,
        protein: goals.protein,
        carbs: goals.carbs,
        fats: goals.fats,
        fiber: goals.fiber,
        eatingPhase: goals.eatingPhase,
        targetWeight: goals.targetWeight,
        targetBodyFat: goals.targetBodyFat,
        targetBMI: goals.targetBMI,
        targetFFMI: goals.targetFFMI,
        targetDate: goals.targetDate ?? null,
      });
      router.back();
    } catch (e) {
      showSnackbar('error', t('nutritionGoals.errorSaving'));
      console.error('Error saving nutrition goals:', e);
    }
  };

  if (isLoading) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScrollView>
        <View className="px-6 pb-2 pt-4">
          <Text
            className="text-2xl font-bold tracking-tight"
            style={{ color: theme.colors.text.white }}
          >
            {t('nutritionGoals.title')}
          </Text>
        </View>
        <NutritionGoalsBody onSave={handleSave} initialGoals={initialGoals} />
      </ScrollView>
    </MasterLayout>
  );
}
