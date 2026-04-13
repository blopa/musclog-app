import { useEffect, useState } from 'react';

import { NutritionGoals } from '@/components/NutritionGoalsBody';
import { EatingPhase } from '@/database/models';
import { UserMetricService } from '@/database/services';
import {
  calculateNutritionPlan,
  eatingPhaseToWeightGoal,
  fiberFromCalories,
} from '@/utils/nutritionCalculator';
import { storedHeightToCm } from '@/utils/unitConversion';

import { useUser } from './useUser';

type RequiredMacroFields = {
  totalCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  eatingPhase: EatingPhase;
};

function getFallbackDefaults(
  eatingPhase: EatingPhase
): Partial<NutritionGoals> & RequiredMacroFields {
  return {
    totalCalories: 2000,
    protein: 150,
    carbs: 200,
    fats: 65,
    fiber: 25,
    eatingPhase,
    targetWeight: null,
    targetBodyFat: null,
    targetBMI: null,
    targetFFMI: null,
    targetDate: null,
    goalStartDate: null,
  };
}

export function useDefaultNutritionGoals(eatingPhase: EatingPhase = 'maintain') {
  const { user } = useUser();
  const [defaults, setDefaults] = useState<Partial<NutritionGoals> & RequiredMacroFields>(() =>
    getFallbackDefaults(eatingPhase)
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const compute = async () => {
      if (!user) {
        if (isMounted) {
          setDefaults(getFallbackDefaults(eatingPhase));
          setIsLoading(false);
        }
        return;
      }

      const [weightMetric, heightMetric, bodyFatMetric] = await Promise.all([
        UserMetricService.getLatest('weight'),
        UserMetricService.getLatest('height'),
        UserMetricService.getLatest('body_fat'),
      ]);

      const weightDecrypted = weightMetric ? await weightMetric.getDecrypted() : null;
      const heightDecrypted = heightMetric ? await heightMetric.getDecrypted() : null;
      const bodyFatDecrypted = bodyFatMetric ? await bodyFatMetric.getDecrypted() : null;

      if (!weightDecrypted || !heightDecrypted) {
        if (isMounted) {
          setDefaults(getFallbackDefaults(eatingPhase));
          setIsLoading(false);
        }
        return;
      }

      const weightKg = weightDecrypted.value;
      const heightCm = storedHeightToCm(heightDecrypted.value, heightDecrypted.unit);
      const age = user.getAge();
      const fitnessGoal = user.fitnessGoal ?? 'general';
      const activityLevel = Math.max(1, Math.min(5, user.activityLevel ?? 3)) as 1 | 2 | 3 | 4 | 5;
      const liftingExperience = user.liftingExperience ?? 'intermediate';
      const gender = user.gender ?? 'other';

      try {
        const plan = calculateNutritionPlan({
          gender,
          weightKg,
          heightCm,
          age,
          activityLevel,
          weightGoal: eatingPhaseToWeightGoal(eatingPhase),
          fitnessGoal,
          liftingExperience,
          bodyFatPercent: bodyFatDecrypted?.value ?? undefined,
        });

        const fiberValue = fiberFromCalories(plan.targetCalories);

        if (isMounted) {
          setDefaults({
            totalCalories: plan.targetCalories,
            protein: plan.protein,
            carbs: plan.carbs,
            fats: plan.fats,
            fiber: fiberValue,
            eatingPhase,
            targetWeight: plan.projectedWeightKg,
            targetBodyFat: plan.targetBodyFat ?? null,
            targetBMI: plan.targetBMI ?? null,
            targetFFMI: plan.targetFFMI ?? null,
            targetDate: null,
            goalStartDate: null,
          });
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setDefaults(getFallbackDefaults(eatingPhase));
          setIsLoading(false);
        }
      }
    };

    compute();
    return () => {
      isMounted = false;
    };
  }, [user, eatingPhase]);

  return { defaults, isLoading };
}
