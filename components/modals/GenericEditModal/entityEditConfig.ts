import type { Model } from '@nozbe/watermelondb';

import {
  ExerciseService,
  FoodPortionService,
  FoodService,
  MealService,
  NutritionGoalService,
  NutritionService,
  UserMetricService,
  WorkoutTemplateService,
} from '../../../database/services';
import type { DataLogModalVariant } from '../DataLogModal';
import type { EditFieldConfig, EditFormValues } from './types';

// Muscle groups for Exercise
const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'full_body',
  'cardio',
  'other',
] as const;

// Equipment types for Exercise
const EQUIPMENT_TYPES = [
  'dumbbell',
  'barbell',
  'bodyweight',
  'machine',
  'cable',
  'kettlebell',
  'resistance_band',
  'other',
] as const;

// Mechanic types for Exercise
const MECHANIC_TYPES = ['compound', 'isolation'] as const;

// User metric types
const USER_METRIC_TYPES = [
  'weight',
  'body_fat',
  'muscle_mass',
  'lean_body_mass',
  'basal_metabolic_rate',
  'total_calories_burned',
  'active_calories_burned',
  'bmi',
  'height',
  'chest',
  'waist',
  'hips',
  'arms',
  'thighs',
  'calves',
  'neck',
  'shoulders',
  'mood',
  'ffmi',
  'nutrition',
  'exercise',
  'other',
] as const;

// Meal types for Nutrition Log
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;

// Eating phases for Nutrition Goal
const EATING_PHASES = ['cut', 'maintain', 'bulk'] as const;

/**
 * Get edit field configuration for a given entity type
 */
export function getEditFields(entityType: DataLogModalVariant): EditFieldConfig[] {
  switch (entityType) {
    case 'meal':
      return [
        {
          type: 'text',
          key: 'name',
          label: 'food.createMeal.mealName',
          placeholder: 'food.createMeal.mealNamePlaceholder',
          required: true,
        },
        {
          type: 'text',
          key: 'description',
          label: 'common.description',
          placeholder: 'common.description',
          multiline: true,
        },
      ];

    case 'exercise':
      return [
        {
          type: 'text',
          key: 'name',
          label: 'exercises.createExercise.exerciseName',
          placeholder: 'exercises.createExercise.exerciseNamePlaceholder',
          required: true,
        },
        {
          type: 'text',
          key: 'description',
          label: 'common.description',
          placeholder: 'common.description',
          multiline: true,
        },
        {
          type: 'select',
          key: 'muscleGroup',
          label: 'exercises.createExercise.primaryMuscleGroup',
          required: true,
          options: MUSCLE_GROUPS.map((mg) => ({
            value: mg,
            label: `exercises.muscleGroups.${mg}`,
          })),
        },
        {
          type: 'select',
          key: 'equipmentType',
          label: 'exercises.viewExercise.equipment',
          required: true,
          options: EQUIPMENT_TYPES.map((et) => ({
            value: et,
            label: `exercises.equipmentTypes.${et}`,
          })),
        },
        {
          type: 'select',
          key: 'mechanicType',
          label: 'exercises.viewExercise.mechanic',
          required: true,
          options: MECHANIC_TYPES.map((mt) => ({
            value: mt,
            label: `exercises.mechanicTypes.${mt}`,
          })),
        },
        {
          type: 'number',
          key: 'loadMultiplier',
          label: 'common.loadMultiplier',
          min: 0,
          step: 0.1,
          required: true,
        },
      ];

    case 'foodPortion':
      return [
        {
          type: 'text',
          key: 'name',
          label: 'common.name',
          placeholder: 'common.name',
          required: true,
        },
        {
          type: 'number',
          key: 'gramWeight',
          label: 'food.foodDetails.grams',
          min: 0,
          step: 1,
          unit: 'g',
          required: true,
        },
        {
          type: 'text',
          key: 'icon',
          label: 'common.icon',
          placeholder: 'common.icon',
        },
      ];

    case 'userMetric':
      return [
        {
          type: 'select',
          key: 'type',
          label: 'bodyMetrics.addEntry.enterWeight',
          required: true,
          options: USER_METRIC_TYPES.map((type) => ({
            value: type,
            label: `bodyMetrics.metrics.${type}`,
          })),
        },
        {
          type: 'number',
          key: 'value',
          label: 'common.value',
          min: 0,
          step: 0.1,
          required: true,
        },
        {
          type: 'date',
          key: 'date',
          label: 'bodyMetrics.addEntry.date',
          required: true,
        },
      ];

    case 'workoutTemplate':
      return [
        {
          type: 'text',
          key: 'name',
          label: 'common.name',
          placeholder: 'common.name',
          required: true,
        },
        {
          type: 'text',
          key: 'description',
          label: 'common.description',
          placeholder: 'common.description',
          multiline: true,
        },
        {
          type: 'boolean',
          key: 'isArchived',
          label: 'common.archived',
          subtitle: 'common.archived',
        },
      ];

    case 'food':
      return [
        {
          type: 'text',
          key: 'name',
          label: 'common.name',
          placeholder: 'common.name',
          required: true,
        },
        {
          type: 'text',
          key: 'brand',
          label: 'food.newCustomFood.brand',
          placeholder: 'food.newCustomFood.brandPlaceholder',
        },
        {
          type: 'number',
          key: 'calories',
          label: 'food.calories',
          min: 0,
          step: 1,
          unit: 'kcal',
          required: true,
        },
        {
          type: 'number',
          key: 'protein',
          label: 'food.macros.protein',
          min: 0,
          step: 0.1,
          unit: 'g',
          required: true,
        },
        {
          type: 'number',
          key: 'carbs',
          label: 'food.macros.carbs',
          min: 0,
          step: 0.1,
          unit: 'g',
          required: true,
        },
        {
          type: 'number',
          key: 'fat',
          label: 'food.macros.fat',
          min: 0,
          step: 0.1,
          unit: 'g',
          required: true,
        },
        {
          type: 'number',
          key: 'fiber',
          label: 'food.macros.fiber',
          min: 0,
          step: 0.1,
          unit: 'g',
        },
      ];

    case 'nutrition_log':
      return [
        {
          type: 'number',
          key: 'amount',
          label: 'food.addFoodItemToMeal.amount',
          min: 0,
          step: 0.1,
          required: true,
        },
        {
          type: 'select',
          key: 'mealType',
          label: 'meals.mealType',
          required: true,
          options: MEAL_TYPES.map((type) => ({
            value: type,
            label: `food.meals.${type === 'snack' ? 'snacks' : type}`,
          })),
        },
      ];

    case 'nutritionGoal':
      return [
        {
          type: 'number',
          key: 'totalCalories',
          label: 'currentGoalsCard.dailyTarget',
          min: 0,
          step: 1,
          unit: 'kcal',
          required: true,
        },
        {
          type: 'number',
          key: 'protein',
          label: 'currentGoalsCard.protein',
          min: 0,
          step: 0.1,
          unit: 'g',
          required: true,
        },
        {
          type: 'number',
          key: 'carbs',
          label: 'currentGoalsCard.carbs',
          min: 0,
          step: 0.1,
          unit: 'g',
          required: true,
        },
        {
          type: 'number',
          key: 'fats',
          label: 'currentGoalsCard.fats',
          min: 0,
          step: 0.1,
          unit: 'g',
          required: true,
        },
        {
          type: 'number',
          key: 'fiber',
          label: 'food.macros.fiber',
          min: 0,
          step: 0.1,
          unit: 'g',
        },
        {
          type: 'select',
          key: 'eatingPhase',
          label: 'common.eatingPhase',
          required: true,
          options: EATING_PHASES.map((phase) => ({
            value: phase,
            label: `goalsManagement.manageGoalData.phase${phase.charAt(0).toUpperCase() + phase.slice(1)}`,
          })),
        },
        {
          type: 'number',
          key: 'targetWeight',
          label: 'currentGoalsCard.targetWeight',
          min: 0,
          step: 0.1,
          unit: 'kg',
          required: true,
        },
        {
          type: 'number',
          key: 'targetBodyFat',
          label: 'currentGoalsCard.bodyFat',
          min: 0,
          step: 0.1,
          unit: '%',
        },
        {
          type: 'number',
          key: 'targetBMI',
          label: 'currentGoalsCard.bmi',
          min: 0,
          step: 0.1,
        },
        {
          type: 'number',
          key: 'targetFFMI',
          label: 'currentGoalsCard.ffmi',
          min: 0,
          step: 0.1,
        },
      ];

    default:
      // For unsupported entity types, return empty array
      return [];
  }
}

/**
 * Extract initial values from a database record
 */
export async function getInitialValues(
  entityType: DataLogModalVariant,
  record: Model
): Promise<EditFormValues> {
  const recordAny = record as any;

  switch (entityType) {
    case 'meal':
      return {
        name: recordAny.name ?? '',
        description: recordAny.description ?? '',
      };

    case 'exercise':
      return {
        name: recordAny.name ?? '',
        description: recordAny.description ?? '',
        muscleGroup: recordAny.muscleGroup ?? 'other',
        equipmentType: recordAny.equipmentType ?? 'other',
        mechanicType: recordAny.mechanicType ?? 'compound',
        loadMultiplier: recordAny.loadMultiplier ?? 1.0,
      };

    case 'foodPortion':
      return {
        name: recordAny.name ?? '',
        gramWeight: recordAny.gramWeight ?? 100,
        icon: recordAny.icon ?? '',
      };

    case 'userMetric':
      return {
        type: recordAny.type ?? 'weight',
        value: recordAny.value ?? 0,
        date: recordAny.date ?? Date.now(),
      };

    case 'workoutTemplate':
      return {
        name: recordAny.name ?? '',
        description: recordAny.description ?? '',
        isArchived: recordAny.isArchived ?? false,
      };

    case 'food':
      return {
        name: recordAny.name ?? '',
        brand: recordAny.brand ?? '',
        calories: recordAny.calories ?? 0,
        protein: recordAny.protein ?? 0,
        carbs: recordAny.carbs ?? 0,
        fat: recordAny.fat ?? 0,
        fiber: recordAny.fiber ?? 0,
      };

    case 'nutrition_log':
      return {
        amount: recordAny.amount ?? 0,
        mealType: recordAny.type ?? 'breakfast',
      };

    case 'nutritionGoal':
      return {
        totalCalories: recordAny.totalCalories ?? 0,
        protein: recordAny.protein ?? 0,
        carbs: recordAny.carbs ?? 0,
        fats: recordAny.fats ?? 0,
        fiber: recordAny.fiber ?? 0,
        eatingPhase: recordAny.eatingPhase ?? 'maintain',
        targetWeight: recordAny.targetWeight ?? 0,
        targetBodyFat: recordAny.targetBodyFat ?? 0,
        targetBMI: recordAny.targetBmi ?? 0,
        targetFFMI: recordAny.targetFfmi ?? 0,
      };

    default:
      return {};
  }
}

/**
 * Save updated values to the database via service layer
 */
export async function saveRecord(
  entityType: DataLogModalVariant,
  recordId: string,
  values: EditFormValues
): Promise<void> {
  switch (entityType) {
    case 'meal':
      await MealService.updateMeal(recordId, {
        name: values.name as string | undefined,
        description: values.description as string | undefined,
      });
      break;

    case 'exercise':
      await ExerciseService.updateExercise(recordId, {
        name: values.name as string | undefined,
        description: values.description as string | undefined,
        muscleGroup: values.muscleGroup as string | undefined,
        equipmentType: values.equipmentType as string | undefined,
        mechanicType: values.mechanicType as string | undefined,
        loadMultiplier: values.loadMultiplier as number | undefined,
      });
      break;

    case 'foodPortion':
      await FoodPortionService.updateFoodPortion(recordId, {
        name: values.name as string | undefined,
        gramWeight: values.gramWeight as number | undefined,
        icon: values.icon as string | undefined,
      });
      break;

    case 'userMetric':
      await UserMetricService.updateMetric(recordId, {
        type: values.type as any,
        value: values.value as number | undefined,
        date: values.date as number | undefined,
      });
      break;

    case 'workoutTemplate':
      await WorkoutTemplateService.updateTemplate(recordId, {
        name: values.name as string | undefined,
        description: values.description as string | undefined,
        isArchived: values.isArchived as boolean | undefined,
      });
      break;

    case 'food':
      await FoodService.updateFood(recordId, {
        name: values.name as string | undefined,
        brand: values.brand as string | undefined,
        calories: values.calories as number | undefined,
        protein: values.protein as number | undefined,
        carbs: values.carbs as number | undefined,
        fat: values.fat as number | undefined,
        fiber: values.fiber as number | undefined,
      });
      break;

    case 'nutrition_log':
      await NutritionService.updateNutritionLog(recordId, {
        amount: values.amount as number | undefined,
        mealType: values.mealType as any,
        // Note: portionId editing would require fetching available portions, deferred for now
      });
      break;

    case 'nutritionGoal':
      await NutritionGoalService.updateGoal(recordId, {
        totalCalories: values.totalCalories as number | undefined,
        protein: values.protein as number | undefined,
        carbs: values.carbs as number | undefined,
        fats: values.fats as number | undefined,
        fiber: values.fiber as number | undefined,
        eatingPhase: values.eatingPhase as any,
        targetWeight: values.targetWeight as number | undefined,
        targetBodyFat: values.targetBodyFat as number | undefined,
        targetBMI: values.targetBMI as number | undefined,
        targetFFMI: values.targetFFMI as number | undefined,
      });
      break;

    default:
      throw new Error(`Saving not implemented for entity type: ${entityType}`);
  }
}
