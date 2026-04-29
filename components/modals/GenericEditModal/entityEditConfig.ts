import type { Model } from '@nozbe/watermelondb';

import type { DataLogModalVariant } from '@/components/modals/DataLogModal';
import type { Units } from '@/constants/settings';
import type UserMetric from '@/database/models/UserMetric';
import {
  ChatService,
  ExerciseService,
  FoodPortionService,
  FoodService,
  MealService,
  NutritionCheckinService,
  NutritionGoalService,
  NutritionService,
  UserMetricService,
  WorkoutTemplateService,
} from '@/database/services';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import {
  displayToCm,
  displayToGrams,
  displayToKg,
  getMassUnitLabel,
  gramsToDisplay,
  isLengthMetricType,
  isWeightMetricType,
} from '@/utils/unitConversion';
import { WORKOUT_ICON_OPTIONS } from '@/utils/workoutIconUtils';

import type { EditFieldConfig, EditFormValues } from './types';

export type SaveRecordContext = { units: Units };

// Muscle groups for Exercise
// Cover all persisted muscle_group values (create flow uses arms/legs/core too).
const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'legs',
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
  'water',
  'supplement',
  'ffmi',
  'nutrition',
  'exercise',
  'other',
] as const;

// Meal types for Nutrition Log
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;

// Eating phases for Nutrition Goal
const EATING_PHASES = ['cut', 'maintain', 'bulk'] as const;

// Checkin statuses for Nutrition Checkin
const CHECKIN_STATUSES = ['pending', 'ahead', 'onTrack', 'behind'] as const;

/**
 * Get edit field configuration for a given entity type.
 * @param entityType The entity type to get fields for.
 * @param units Optional user unit system, used to show correct unit labels (kg vs lbs, cm vs in).
 */
export function getEditFields(entityType: DataLogModalVariant, units?: Units): EditFieldConfig[] {
  const weightUnitLabel = units === 'imperial' ? 'lbs' : 'kg';
  const lengthUnitLabel = units === 'imperial' ? 'in' : 'cm';
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
          label: units === 'imperial' ? 'food.portionSizes.oz' : 'food.foodDetails.grams',
          min: 0,
          step: units === 'imperial' ? 0.1 : 1,
          maxFractionDigits: units === 'imperial' ? 2 : 0,
          unit: getMassUnitLabel(units ?? 'metric'),
          required: true,
        },
        {
          type: 'icon',
          key: 'icon',
          label: 'common.icon',
        },
      ];

    case 'userMetric':
      return [
        {
          type: 'select',
          key: 'type',
          label: 'bodyMetrics.addEntry.enterType',
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
          type: 'select',
          key: 'icon',
          label: 'common.icon',
          options: [
            { value: '', label: 'common.none' },
            ...WORKOUT_ICON_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          ],
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
          type: 'text',
          key: 'barcode',
          label: 'food.newCustomFood.barcode',
          placeholder: 'food.newCustomFood.barcodePlaceholder',
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
          type: 'boolean',
          key: 'isDynamic',
          label: 'nutritionGoals.dynamic',
          subtitle: 'nutritionGoals.dynamicInfo',
        },
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
          unit: weightUnitLabel,
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
        {
          type: 'date',
          key: 'targetDate',
          label: 'nutritionGoals.targetDate',
        },
      ];

    case 'chatMessage':
      return [
        {
          type: 'text',
          key: 'message',
          label: 'ai.chat.message',
          placeholder: 'ai.chat.typeYourMessage',
          required: true,
          multiline: true,
        },
      ];

    case 'nutritionCheckin':
      return [
        {
          type: 'date',
          key: 'checkinDate',
          label: 'goalsManagement.manageCheckinData.checkinDate',
          required: true,
        },
        {
          type: 'select',
          key: 'status',
          label: 'common.status',
          required: true,
          options: CHECKIN_STATUSES.map((status) => ({
            value: status,
            label: `nutrition.checkin.status.${status}`,
          })),
        },
        {
          type: 'number',
          key: 'targetWeight',
          label: 'currentGoalsCard.targetWeight',
          min: 0,
          step: 0.1,
          unit: weightUnitLabel,
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
          key: 'targetBmi',
          label: 'currentGoalsCard.bmi',
          min: 0,
          step: 0.1,
        },
        {
          type: 'number',
          key: 'targetFfmi',
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

    case 'userMetric': {
      const decrypted = await (record as UserMetric).getDecrypted();
      return {
        type: recordAny.type ?? 'weight',
        value: decrypted.value ?? 0,
        date: decrypted.date ?? Date.now(),
      };
    }

    case 'workoutTemplate':
      return {
        name: recordAny.name ?? '',
        description: recordAny.description ?? '',
        icon: recordAny.icon ?? '',
        isArchived: recordAny.isArchived ?? false,
      };

    case 'food':
      return {
        name: recordAny.name ?? '',
        brand: recordAny.brand ?? '',
        barcode: recordAny.barcode ?? '',
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
        isDynamic: recordAny.isDynamic ?? false,
        targetWeight: recordAny.targetWeight ?? 0,
        targetBodyFat: recordAny.targetBodyFat ?? undefined,
        targetBMI: recordAny.targetBmi ?? undefined,
        targetFFMI: recordAny.targetFfmi ?? undefined,
        targetDate: recordAny.targetDate ?? null,
      };

    case 'chatMessage':
      return {
        message: recordAny.message ?? '',
      };

    case 'nutritionCheckin':
      return {
        checkinDate: recordAny.checkinDate ?? Date.now(),
        status: recordAny.status ?? 'pending',
        targetWeight: recordAny.targetWeight ?? 0,
        targetBodyFat: recordAny.targetBodyFat ?? undefined,
        targetBmi: recordAny.targetBmi ?? undefined,
        targetFfmi: recordAny.targetFfmi ?? undefined,
      };

    default:
      return {};
  }
}

/**
 * Save updated values to the database via service layer
 * @param entityType
 * @param recordId
 * @param values
 * @param context - Optional context e.g. { units } for userMetric weight/height conversion
 */
export async function saveRecord(
  entityType: DataLogModalVariant,
  recordId: string,
  values: EditFormValues,
  context?: SaveRecordContext
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

    case 'foodPortion': {
      let gramWeight = values.gramWeight as number | undefined;
      if (gramWeight != null && context?.units) {
        gramWeight = Math.round(displayToGrams(gramWeight, context.units));
      }

      await FoodPortionService.updateFoodPortion(recordId, {
        name: values.name as string | undefined,
        gramWeight,
        icon: values.icon as string | undefined,
      });
      break;
    }

    case 'userMetric': {
      const type = values.type as string | undefined;
      let value = values.value as number | undefined;
      let unit: string | undefined;
      if (context?.units && type && value != null) {
        if (isWeightMetricType(type)) {
          value = displayToKg(value, context.units);
          unit = 'kg';
        } else if (isLengthMetricType(type)) {
          value = displayToCm(value, context.units);
          unit = 'cm';
        }
      }

      await UserMetricService.updateMetric(recordId, {
        type: type as any,
        value,
        unit,
        date: values.date as number | undefined,
      });
      break;
    }

    case 'workoutTemplate':
      await WorkoutTemplateService.updateTemplate(recordId, {
        name: values.name as string | undefined,
        description: values.description as string | undefined,
        icon:
          (values.icon as string) !== undefined && (values.icon as string) !== ''
            ? (values.icon as string)
            : undefined,
        isArchived: values.isArchived as boolean | undefined,
      });
      break;

    case 'food':
      await FoodService.updateFood(recordId, {
        name: values.name as string | undefined,
        brand: values.brand as string | undefined,
        barcode: values.barcode as string | undefined,
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

    case 'nutritionGoal': {
      let targetWeightKg = values.targetWeight as number | undefined;
      if (context?.units && targetWeightKg != null) {
        targetWeightKg = displayToKg(targetWeightKg, context.units);
      }

      await NutritionGoalService.updateGoal(
        recordId,
        {
          totalCalories: values.totalCalories as number | undefined,
          protein: values.protein as number | undefined,
          carbs: values.carbs as number | undefined,
          fats: values.fats as number | undefined,
          fiber: values.fiber as number | undefined,
          eatingPhase: values.eatingPhase as any,
          isDynamic: values.isDynamic !== undefined ? Boolean(values.isDynamic) : undefined,
          targetWeight: targetWeightKg,
          targetBodyFat: values.targetBodyFat as number | undefined,
          targetBMI: values.targetBMI as number | undefined,
          targetFFMI: values.targetFFMI as number | undefined,
          targetDate: values.targetDate !== undefined
            ? (values.targetDate as number | null | undefined) ?? null
            : undefined,
        },
        true
      );
      break;
    }

    case 'chatMessage':
      await ChatService.updateMessage(recordId, values.message as string);
      break;

    case 'nutritionCheckin': {
      let targetWeightKg = values.targetWeight as number | undefined;
      if (context?.units && targetWeightKg != null) {
        targetWeightKg = displayToKg(targetWeightKg, context.units);
      }

      await NutritionCheckinService.update(recordId, {
        checkinDate: values.checkinDate as number | undefined,
        status: values.status as any,
        targetWeight: targetWeightKg,
        targetBodyFat: values.targetBodyFat as number | undefined,
        targetBmi: values.targetBmi as number | undefined,
        targetFfmi: values.targetFfmi as number | undefined,
      });
      break;
    }

    default:
      // Implement saving for this entity type or remove from supported types
      throw new Error(`Saving not implemented for entity type: ${entityType}`);
  }
}

/**
 * Get create field configuration for a given entity type.
 * Similar to getEditFields but may include extra fields only relevant on creation (e.g. sender for chatMessage).
 */
export function getCreateFields(entityType: DataLogModalVariant, units?: Units): EditFieldConfig[] {
  if (entityType === 'chatMessage') {
    return [
      ...getEditFields('chatMessage', units),
      {
        type: 'select',
        key: 'sender',
        label: 'coach.chatMessages.sender',
        required: true,
        options: [
          { value: 'user', label: 'coach.chatMessages.senderUser' },
          { value: 'coach', label: 'coach.chatMessages.senderCoach' },
        ],
      },
      {
        type: 'select',
        key: 'context',
        label: 'common.context',
        required: true,
        options: [
          { value: 'general', label: 'coach.context.general' },
          { value: 'exercise', label: 'coach.context.exercise' },
          { value: 'nutrition', label: 'coach.context.nutrition' },
        ],
      },
    ];
  }

  return getEditFields(entityType, units);
}

/**
 * Get default (empty) initial values for creating a new record.
 */
export function getCreateInitialValues(
  entityType: DataLogModalVariant,
  units?: Units
): EditFormValues {
  switch (entityType) {
    case 'chatMessage':
      return { message: '', sender: 'user', context: 'general' };

    case 'userMetric':
      return { type: 'weight', value: 0, date: Date.now() };

    case 'nutritionGoal':
      return {
        totalCalories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        eatingPhase: 'maintain',
        targetWeight: 0,
        targetBodyFat: undefined,
        targetBMI: undefined,
        targetFFMI: undefined,
      };

    case 'nutritionCheckin':
      return {
        checkinDate: Date.now(),
        status: 'pending',
        targetWeight: 0,
        targetBodyFat: undefined,
        targetBmi: undefined,
        targetFfmi: undefined,
      };

    case 'meal':
      return { name: '', description: '' };

    case 'exercise':
      return {
        name: '',
        description: '',
        muscleGroup: 'other',
        equipmentType: 'other',
        mechanicType: 'compound',
        loadMultiplier: 1.0,
      };

    case 'food':
      return {
        name: '',
        brand: '',
        barcode: '',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      };

    case 'foodPortion':
      return {
        name: '',
        gramWeight: gramsToDisplay(100, units ?? 'metric'),
        icon: '',
      };

    case 'workoutTemplate':
      return { name: '', description: '', icon: '', isArchived: false };

    default:
      return {};
  }
}

/**
 * Create a new record in the database via service layer.
 */
export async function createRecord(
  entityType: DataLogModalVariant,
  values: EditFormValues,
  context?: SaveRecordContext
): Promise<void> {
  switch (entityType) {
    case 'chatMessage': {
      await ChatService.saveMessage({
        sender: values.sender as 'user' | 'coach',
        message: String(values.message ?? ''),
        context: (values.context as any) ?? 'general',
      });
      break;
    }

    case 'userMetric': {
      const type = values.type as string;
      let value = values.value as number;
      let unit: string | undefined;
      if (context?.units && type && value != null) {
        if (isWeightMetricType(type)) {
          value = displayToKg(value, context.units);
          unit = 'kg';
        } else if (isLengthMetricType(type)) {
          value = displayToCm(value, context.units);
          unit = 'cm';
        }
      }

      const rawDate = (values.date as number) ?? Date.now();
      await UserMetricService.createMetric({
        type,
        value,
        unit,
        date: localDayStartFromUtcMs(rawDate),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      break;
    }

    case 'nutritionGoal': {
      let targetWeightKg = values.targetWeight as number;
      if (context?.units && targetWeightKg != null) {
        targetWeightKg = displayToKg(targetWeightKg, context.units);
      }

      const savedGoal = await NutritionGoalService.saveGoals({
        totalCalories: values.totalCalories as number,
        protein: values.protein as number,
        carbs: values.carbs as number,
        fats: values.fats as number,
        fiber: (values.fiber as number) ?? 0,
        eatingPhase: values.eatingPhase as any,
        isDynamic: Boolean(values.isDynamic),
        targetWeight: targetWeightKg,
        targetBodyFat: values.targetBodyFat as number | undefined,
        targetBMI: values.targetBMI as number | undefined,
        targetFFMI: values.targetFFMI as number | undefined,
        targetDate: (values.targetDate as number | null | undefined) ?? null,
      });

      await NutritionGoalService.regenerateCheckins(savedGoal.id);
      break;
    }

    case 'nutritionCheckin': {
      const currentGoal = await NutritionGoalService.getCurrent();
      if (!currentGoal) {
        throw new Error('No active nutrition goal found. Create a nutrition goal first.');
      }

      let targetWeightKg = values.targetWeight as number;
      if (context?.units && targetWeightKg != null) {
        targetWeightKg = displayToKg(targetWeightKg, context.units);
      }

      await NutritionCheckinService.create(currentGoal.id, {
        checkinDate: (values.checkinDate as number) ?? Date.now(),
        status: values.status as any,
        targetWeight: targetWeightKg,
        targetBodyFat: values.targetBodyFat as number | undefined,
        targetBmi: values.targetBmi as number | undefined,
        targetFfmi: values.targetFfmi as number | undefined,
      });
      break;
    }

    default:
      throw new Error(`Creating not implemented for entity type: ${entityType}`);
  }
}
