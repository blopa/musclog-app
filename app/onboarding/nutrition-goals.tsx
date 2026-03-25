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
import { TEMP_NUTRITION_PLAN } from '../../constants/misc';
import { EatingPhase } from '../../database/models';
import {
  NutritionCheckinService,
  NutritionGoalService,
  UserMetricService,
} from '../../database/services';
import { useCurrentNutritionGoal } from '../../hooks/useCurrentNutritionGoal';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import {
  calculateNutritionPlan,
  eatingPhaseToWeightGoal,
  generateWeeklyCheckins,
  NutritionPlan,
  planToInitialGoals,
} from '../../utils/nutritionCalculator';
import { showSnackbar } from '../../utils/snackbarService';

export default function NutritionGoalsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { goal, isLoading } = useCurrentNutritionGoal();
  const { units } = useSettings();
  const [currentGoals, setCurrentGoals] = useState<NutritionGoals | null>(null);
  const [storedPlanGoals, setStoredPlanGoals] = useState<Partial<NutritionGoals> | null>(null);
  const params = useLocalSearchParams<{
    isAdjusting?: string;
    isCheckinAdjusting?: string;
    checkinId?: string;
  }>();
  const isAdjusting = params.isAdjusting === 'true';
  const isCheckinAdjusting = params.isCheckinAdjusting === 'true';

  // Load TEMP_NUTRITION_PLAN on mount so "Adjust Goals Manually" can pre-fill from the plan just viewed.
  // We prefer this over the DB goal in initialGoals when present.
  useEffect(() => {
    let isMounted = true;
    const doTask = async () => {
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
    };

    doTask();

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
        const newGoal = await NutritionGoalService.saveGoals({
          totalCalories: goals.totalCalories,
          protein: goals.protein,
          carbs: goals.carbs,
          fats: goals.fats,
          fiber: goals.fiber,
          eatingPhase: goals.eatingPhase,
          targetWeight: goals.targetWeight ?? undefined,
          targetBodyFat: goals.targetBodyFat ?? undefined,
          targetBMI: goals.targetBMI ?? undefined,
          targetFFMI: goals.targetFFMI ?? undefined,
          targetDate: goals.targetDate ?? null,
        });

        // Generate new check-ins for the new goal
        const userMetric = await UserMetricService.getLatest('weight');
        const heightMetric = await UserMetricService.getLatest('height');
        const bodyFatMetric = await UserMetricService.getLatest('body_fat');

        if (userMetric && heightMetric) {
          const userDecrypted = await userMetric.getDecrypted();
          const heightDecrypted = await heightMetric.getDecrypted();
          const bodyFatDecrypted = bodyFatMetric ? await bodyFatMetric.getDecrypted() : null;

          const plan = calculateNutritionPlan({
            gender: 'other', // fallback
            weightKg: userDecrypted.value,
            heightCm: heightDecrypted.value,
            age: 25, // fallback
            activityLevel: 3, // fallback
            weightGoal: eatingPhaseToWeightGoal(goals.eatingPhase),
            fitnessGoal: 'general',
            liftingExperience: 'intermediate',
            bodyFatPercent: bodyFatDecrypted?.value,
          });

          const checkins = generateWeeklyCheckins(
            plan,
            Date.now(),
            goals.targetDate ?? Date.now() + 90 * 24 * 60 * 60 * 1000,
            heightDecrypted.value / 100,
            bodyFatDecrypted?.value ?? null
          );

          if (checkins.length > 0) {
            await NutritionCheckinService.createBatch(newGoal.id, checkins);
          }
        }

        // If the user arrived here from the results screen to adjust the AI plan,
        // then after saving we should continue the onboarding flow to personal-info.
        if (isAdjusting) {
          router.push('/onboarding/personal-info');
          return;
        }

        if (isCheckinAdjusting) {
          router.replace('/nutrition/checkin-list');
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
    [isAdjusting, isCheckinAdjusting, router, t]
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
