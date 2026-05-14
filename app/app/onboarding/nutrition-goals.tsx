import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { NutritionGoals, NutritionGoalsBody } from '@/components/NutritionGoalsBody';
import { Button } from '@/components/theme/Button';
import { TEMP_NUTRITION_PLAN } from '@/constants/misc';
import { EatingPhase } from '@/database/models';
import {
  NutritionCheckinService,
  NutritionGoalService,
  UserMetricService,
} from '@/database/services';
import { useCurrentNutritionGoal } from '@/hooks/useCurrentNutritionGoal';
import { useDefaultNutritionGoals } from '@/hooks/useDefaultNutritionGoals';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { localDayKeyPlusCalendarDaysFromNow } from '@/utils/calendarDate';
import {
  calculateNutritionPlan,
  eatingPhaseToWeightGoal,
  generateWeeklyCheckins,
  NutritionPlan,
  planToInitialGoals,
} from '@/utils/nutritionCalculator';
import {
  isDynamicNutritionGoalValid,
  normalizeNutritionGoalTargetWeight,
} from '@/utils/nutritionGoalHelpers';
import { showSnackbar } from '@/utils/snackbarService';

export default function NutritionGoalsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { disableMinimumCalories, useBfForCalculations } = useSettings();
  const { goal, isLoading } = useCurrentNutritionGoal();
  const { defaults: computedDefaults, isLoading: isLoadingDefaults } = useDefaultNutritionGoals();
  const [currentGoals, setCurrentGoals] = useState<NutritionGoals | null>(null);
  const [storedPlanGoals, setStoredPlanGoals] = useState<Partial<NutritionGoals> | null>(null);
  const params = useLocalSearchParams<{
    isAdjusting?: string;
    isCheckinAdjusting?: string;
    checkinId?: string;
    quickSetup?: string;
    personalizedSetup?: string;
  }>();
  const isAdjusting = params.isAdjusting === 'true';
  const isCheckinAdjusting = params.isCheckinAdjusting === 'true';
  const isQuickSetup = params.quickSetup === 'true';
  const isPersonalizedSetup = params.personalizedSetup === 'true';
  let nutritionGoalsBodyKey = 'empty';
  if (goal) {
    nutritionGoalsBodyKey = `goal-${goal.id}`;
  } else if (storedPlanGoals) {
    nutritionGoalsBodyKey = 'stored-plan';
  }

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
  const initialGoals = useMemo<
    Partial<NutritionGoals> & {
      totalCalories: number;
      protein: number;
      carbs: number;
      fats: number;
      fiber: number;
      eatingPhase: EatingPhase;
    }
  >(() => {
    if (storedPlanGoals) {
      return storedPlanGoals as Partial<NutritionGoals> & {
        totalCalories: number;
        protein: number;
        carbs: number;
        fats: number;
        fiber: number;
        eatingPhase: EatingPhase;
      };
    }

    if (goal) {
      return {
        totalCalories: goal.totalCalories,
        protein: goal.protein,
        carbs: goal.carbs,
        fats: goal.fats,
        fiber: goal.fiber,
        eatingPhase: goal.eatingPhase as EatingPhase,
        targetWeight: normalizeNutritionGoalTargetWeight(goal.targetWeight),
        targetBodyFat: goal.targetBodyFat,
        targetBMI: goal.targetBmi,
        targetFFMI: goal.targetFfmi,
        targetDate: goal.targetDate ?? null,
        isDynamic: goal.isDynamic,
      };
    }

    return computedDefaults;
  }, [goal, storedPlanGoals, computedDefaults]);

  const handleSave = useCallback(
    async (goals: NutritionGoals) => {
      if (!isDynamicNutritionGoalValid(goals)) {
        showSnackbar('error', t('nutritionGoals.dynamicRequiredFields'));
        return;
      }

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
          isDynamic: goals.isDynamic ?? false,
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
            activityLevel: 2, // fallback
            weightGoal: eatingPhaseToWeightGoal(goals.eatingPhase),
            fitnessGoal: 'general',
            liftingExperience: 'intermediate',
            bodyFatPercent: useBfForCalculations ? bodyFatDecrypted?.value : undefined,
            disableMinimumCalories,
          });

          const checkins = generateWeeklyCheckins(
            plan,
            Date.now(),
            goals.targetDate ?? localDayKeyPlusCalendarDaysFromNow(90),
            heightDecrypted.value / 100,
            useBfForCalculations ? (bodyFatDecrypted?.value ?? null) : null
          );

          if (checkins.length > 0) {
            await NutritionCheckinService.createBatch(newGoal.id, checkins);
          }
        }

        if (isAdjusting) {
          router.navigate({
            pathname: '/app/onboarding/nutrition-goals-results',
            params: {
              aiGenerated: 'false',
              quickSetup: isQuickSetup ? 'true' : 'false',
              personalizedSetup: isPersonalizedSetup ? 'true' : 'false',
            },
          });

          return;
        }

        if (isCheckinAdjusting) {
          router.replace('/app/nutrition/checkin-list');
          return;
        }

        router.navigate({
          pathname: '/app/onboarding/nutrition-goals-results',
          params: { aiGenerated: 'false', quickSetup: isQuickSetup ? 'true' : 'false' },
        });
      } catch (e) {
        showSnackbar('error', t('nutritionGoals.errorSaving'));
        console.error('Error saving nutrition goals:', e);
      }
    },
    [
      disableMinimumCalories,
      useBfForCalculations,
      isAdjusting,
      isCheckinAdjusting,
      isPersonalizedSetup,
      isQuickSetup,
      router,
      t,
    ]
  );

  if (isLoading || isLoadingDefaults) {
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
            key={nutritionGoalsBodyKey}
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
            disabled={!currentGoals || !isDynamicNutritionGoalValid(currentGoals)}
          />
          <View style={{ height: theme.spacing.margin.md }} />
        </BottomButtonWrapper>
      </View>
    </MasterLayout>
  );
}
