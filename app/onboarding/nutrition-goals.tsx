import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { MasterLayout } from '../../components/MasterLayout';
import { NutritionGoals, NutritionGoalsBody } from '../../components/NutritionGoalsBody';
import { Button } from '../../components/theme/Button';
import { TEMP_NUTRITION_PLAN } from '../../constants/auth';
import { EatingPhase } from '../../database/models';
import { NutritionGoalService } from '../../database/services';
import { useCurrentNutritionGoal } from '../../hooks/useCurrentNutritionGoal';
import { theme } from '../../theme';
import { NutritionPlan, planToInitialGoals } from '../../utils/nutritionCalculator';
import { showSnackbar } from '../../utils/snackbarService';

export default function NutritionGoalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { goal, isLoading } = useCurrentNutritionGoal();
  const [currentGoals, setCurrentGoals] = useState<NutritionGoals | null>(null);
  const [storedPlanGoals, setStoredPlanGoals] = useState<Partial<NutritionGoals> | null>(null);
  const params = useLocalSearchParams<{ isAdjusting?: string }>();
  const isAdjusting = params.isAdjusting === 'true';

  // Load TEMP_NUTRITION_PLAN on mount so "Adjust Goals Manually" can pre-fill from the plan just viewed.
  // We prefer this over the DB goal in initialGoals when present.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TEMP_NUTRITION_PLAN);
        if (!raw || !isMounted) {
          return;
        }
        const parsed = JSON.parse(raw) as NutritionPlan;
        if (isMounted && parsed?.targetCalories != null) {
          setStoredPlanGoals(planToInitialGoals(parsed));
        }
      } catch {
        // ignore parse errors
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Map goal data or stored plan to initialGoals format.
  // Prefer stored plan (e.g. from "Adjust Goals Manually") over DB goal so the user sees the plan they just viewed.
  const initialGoals = useMemo<Partial<NutritionGoals> | undefined>(() => {
    if (storedPlanGoals) {
      return storedPlanGoals;
    }

    if (goal) {
      return {
        totalCalories: goal.totalCalories,
        protein: goal.protein,
        carbs: goal.carbs,
        fats: goal.fats,
        fiber: goal.fiber,
        eatingPhase: goal.eatingPhase as EatingPhase,
        targetWeight: goal.targetWeight,
        targetBodyFat: goal.targetBodyFat,
        targetBMI: goal.targetBmi,
        targetFFMI: goal.targetFfmi,
        targetDate: goal.targetDate ?? null,
      };
    }

    return undefined;
  }, [goal, storedPlanGoals]);

  const handleSave = useCallback(
    async (goals: NutritionGoals) => {
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

        // If the user arrived here from the results screen to adjust the AI plan,
        // then after saving we should continue the onboarding flow to personal-info.
        if (isAdjusting) {
          router.push('/onboarding/personal-info');
          return;
        }

        router.push({
          pathname: '/onboarding/nutrition-goals-results',
          params: { aiGenerated: 'false' },
        });
      } catch (e) {
        showSnackbar('error', t('nutritionGoals.errorSaving'));
        console.error('Error saving nutrition goals:', e);
      }
    },
    [isAdjusting, router, t]
  );

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
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: theme.spacing.padding['4xl'] }}
        >
          <View className="px-6 pb-2 pt-4">
            <Text
              className="text-2xl font-bold tracking-tight"
              style={{ color: theme.colors.text.white }}
            >
              {t('nutritionGoals.title')}
            </Text>
          </View>
          <NutritionGoalsBody
            key={goal ? `goal-${goal.id}` : storedPlanGoals ? 'stored-plan' : 'empty'}
            onSave={handleSave}
            initialGoals={initialGoals}
            showSaveButton={false}
            onFormChange={setCurrentGoals}
          />
        </ScrollView>
        <BottomButtonWrapper>
          <Button
            label={t('nutritionGoals.saveGoals')}
            icon={ChevronRight}
            iconPosition="right"
            variant="gradientCta"
            size="md"
            width="full"
            onPress={() => currentGoals && handleSave(currentGoals)}
            disabled={!currentGoals}
          />
          <View style={{ height: theme.spacing.margin.md }} />
        </BottomButtonWrapper>
      </View>
    </MasterLayout>
  );
}
