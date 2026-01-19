import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { NutritionGoalsBody, NutritionGoals } from '../../components/NutritionGoalsBody';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { NutritionGoalService } from '../../database/services/NutritionGoalService';

export default function NutritionGoalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [initialGoals, setInitialGoals] = useState<Partial<NutritionGoals> | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      try {
        const row = await NutritionGoalService.getCurrent();
        if (row) {
          setInitialGoals({
            totalCalories: row.totalCalories,
            protein: row.protein,
            carbs: row.carbs,
            fats: row.fats,
            fiber: row.fiber,
            eatingPhase: row.eatingPhase as 'cut' | 'maintain' | 'bulk',
            targetWeight: row.targetWeight,
            targetBodyFat: row.targetBodyFat,
            targetBMI: row.targetBmi,
            targetFFMI: row.targetFfmi,
            targetDate: row.targetDate ?? null,
          });
        }
      } catch (e) {
        console.error('Error loading nutrition goals:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

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
      console.error('Error saving nutrition goals:', e);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
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
    </SafeAreaView>
  );
}
