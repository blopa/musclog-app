import * as ImagePicker from 'expo-image-picker';
import type { TFunction } from 'i18next';
import {
  Apple,
  Camera,
  Check,
  CheckCircle2,
  Coffee,
  Moon,
  MoreHorizontal,
  Plus,
  Trash2,
  Utensils,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, Switch, Text, View } from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { FoodNutritionSectionCard } from '@/components/cards/FoodNutritionSectionCard';
import { FilterTabs } from '@/components/FilterTabs';
import { OptionsSelector, type SelectorOption } from '@/components/OptionsSelector';
import { ServingSizeSelector } from '@/components/ServingSizeSelector';
import { Button } from '@/components/theme/Button';
import { MenuButton } from '@/components/theme/MenuButton';
import { StepperInput } from '@/components/theme/StepperInput';
import { TextInput } from '@/components/theme/TextInput';
import { useSnackbar } from '@/context/SnackbarContext';
import type { MealType } from '@/database/models';
import Food from '@/database/models/Food';
import Meal from '@/database/models/Meal';
import { FoodPortionService, MealService, NutritionService } from '@/database/services';
import {
  createIngredientLocalId,
  type Ingredient,
  useEditMealIngredients,
} from '@/hooks/useEditMealIngredients';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';
import { blurFilter } from '@/utils/blurFilter';
import { localCalendarDayDate, withCurrentTimeOnDay } from '@/utils/calendarDate';
import { deleteMealImage, saveMealImage } from '@/utils/file';
import { handleError } from '@/utils/handleError';
import { displayToGrams, getMassUnitLabel, gramsToDisplay } from '@/utils/unitConversion';

import { AddFoodItemToMealModal } from './AddFoodItemToMealModal';
import { ConfirmationModal } from './ConfirmationModal';
import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';

const getMealTypeOptions = (theme: Theme, t: TFunction): SelectorOption<MealType>[] => [
  {
    id: 'breakfast',
    label: t('food.meals.breakfast'),
    description: t('food.meals.descriptions.breakfast'),
    icon: Coffee,
    iconBgColor: theme.colors.status.warning10,
    iconColor: theme.colors.status.warning,
  },
  {
    id: 'lunch',
    label: t('food.meals.lunch'),
    description: t('food.meals.descriptions.lunch'),
    icon: Utensils,
    iconBgColor: theme.colors.status.info10,
    iconColor: theme.colors.status.info,
  },
  {
    id: 'dinner',
    label: t('food.meals.dinner'),
    description: t('food.meals.descriptions.dinner'),
    icon: Moon,
    iconBgColor: theme.colors.status.purple10,
    iconColor: theme.colors.status.purple,
  },
  {
    id: 'snack',
    label: t('food.meals.snacks'),
    description: t('food.meals.descriptions.snack'),
    icon: Apple,
    iconBgColor: theme.colors.status.success20,
    iconColor: theme.colors.status.success,
  },
  {
    id: 'other',
    label: t('food.meals.other'),
    description: t('food.meals.descriptions.other'),
    icon: MoreHorizontal,
    iconBgColor: theme.colors.status.gray10,
    iconColor: theme.colors.text.secondary,
  },
];

type CreateMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: () => void; // Callback to refresh meals list
  meal?: Meal; // When provided, the modal operates in edit mode
  /** When 'quickTrack', show date/meal type/track flow and optional save to My Meals. */
  mode?: 'create' | 'quickTrack';
  /** For quickTrack mode: default date to log to. */
  logDate?: Date;
  /** For quickTrack mode: called after ingredients are logged (and optionally meal saved). */
  onTracked?: () => void;
  /** Optional initial foods to prefill the modal (create mode). */
  initialFoods?: { food: Food; amount: number }[];
  /** For quickTrack mode: pre-selected meal type instead of defaulting to 'lunch'. */
  initialMealType?: MealType;
  /** Called before closing when a nutrition log is tracked for the first time. */
  onFirstNutritionLog?: () => void;
  /** Called before closing when a meal is created for the first time. */
  onFirstMealCreated?: () => void;
};

async function buildIngredientFromFood(
  food: Food,
  amount: number,
  t: TFunction
): Promise<Ingredient> {
  if (food.resolvedNutritionBasis === 'per_serving') {
    const nutrients = food.getNutrientsForServingCount(amount);
    const baseGrams = await food.getBaseGramWeight();
    return {
      localId: createIngredientLocalId(food.id),
      foodId: food.id,
      name: food.name ?? t('meals.unknownFood'),
      amount,
      referenceGrams: amount * baseGrams,
      isPerServing: true,
      calories: nutrients.calories,
      protein: nutrients.protein,
      carbs: nutrients.carbs,
      fat: nutrients.fat,
      fiber: nutrients.fiber,
      sugar: (food.micros?.sugar ?? 0) * amount,
      saturatedFat: (food.micros?.saturatedFat ?? 0) * amount,
      sodium: (food.micros?.sodium ?? 0) * amount,
      alcohol: (food.micros?.alcohol ?? 0) * amount,
      potassium: (food.micros?.potassium ?? 0) * amount,
      magnesium: (food.micros?.magnesium ?? 0) * amount,
      zinc: (food.micros?.zinc ?? 0) * amount,
    };
  }

  const multiplier = amount / 100;
  return {
    localId: createIngredientLocalId(food.id),
    foodId: food.id,
    name: food.name ?? t('meals.unknownFood'),
    amount,
    referenceGrams: amount,
    isPerServing: false,
    calories: food.calories * multiplier,
    protein: food.protein * multiplier,
    carbs: food.carbs * multiplier,
    fat: food.fat * multiplier,
    fiber: food.fiber * multiplier,
    sugar: (food.micros?.sugar ?? 0) * multiplier,
    saturatedFat: (food.micros?.saturatedFat ?? 0) * multiplier,
    sodium: (food.micros?.sodium ?? 0) * multiplier,
    alcohol: (food.micros?.alcohol ?? 0) * multiplier,
    potassium: (food.micros?.potassium ?? 0) * multiplier,
    magnesium: (food.micros?.magnesium ?? 0) * multiplier,
    zinc: (food.micros?.zinc ?? 0) * multiplier,
  };
}

export function CreateMealModal({
  visible,
  onClose,
  onSave,
  meal,
  mode = 'create',
  logDate,
  onTracked,
  initialFoods,
  initialMealType = 'lunch',
  onFirstNutritionLog,
  onFirstMealCreated,
}: CreateMealModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();
  const { units, intuitiveEatingMode } = useSettings();
  const massUnit = getMassUnitLabel(units);
  const stepDisplay = units === 'imperial' ? 0.5 : 10;
  const stepAmount = units === 'imperial' ? displayToGrams(0.5, units) : 10;
  const { showSnackbar } = useSnackbar();
  const [mealName, setMealName] = useState('');
  const [mealDescription, setMealDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isAddFoodVisible, setIsAddFoodVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmationModalVisible, setIsConfirmationModalVisible] = useState(false);
  const [mealOptionsMenuVisible, setMealOptionsMenuVisible] = useState(false);
  const [deleteMealConfirmVisible, setDeleteMealConfirmVisible] = useState(false);
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);
  const [ingredientToRemoveId, setIngredientToRemoveId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() =>
    localCalendarDayDate(logDate ?? new Date())
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(initialMealType);
  const [saveToMyMeals, setSaveToMyMeals] = useState(false);
  const [mealAmountGrams, setMealAmountGrams] = useState(0);
  const [preparedWeightGrams, setPreparedWeightGrams] = useState<number | undefined>(undefined);
  const [nutritionBasis, setNutritionBasis] = useState<'per_recipe' | 'per_serving' | 'per_gram'>(
    'per_recipe'
  );
  const [recipeServingsCount, setRecipeServingsCount] = useState(1);
  const [defaultPortionName, setDefaultPortionName] = useState('');
  const [servingGrams, setServingGrams] = useState(100);

  const isQuickTrack = mode === 'quickTrack';

  const { ingredients, setIngredients, removedMealFoodIdsRef } = useEditMealIngredients(
    isQuickTrack ? undefined : meal
  );

  const assertSavedMealIntegrity = async (
    mealId: string,
    expectedFoodCount: number,
    context: string
  ) => {
    const savedMeal = await MealService.getMealWithFoods(mealId);

    if (!savedMeal) {
      throw new Error(`${context}: meal could not be reloaded after save`);
    }

    const actualFoodCount = savedMeal.foods.length;
    if (actualFoodCount === 0) {
      throw new Error(`${context}: saved meal has zero foods after save`);
    }

    if (actualFoodCount !== expectedFoodCount) {
      throw new Error(
        `${context}: expected ${expectedFoodCount} foods after save but found ${actualFoodCount}`
      );
    }
  };

  useEffect(() => {
    const syncFromMeal = () => {
      setMealName(meal?.name ?? '');
      setMealDescription(meal?.description ?? '');
      setImageUrl(meal?.imageUrl ?? undefined);
      setPreparedWeightGrams(meal?.preparedWeightGrams ?? undefined);
      setNutritionBasis(meal?.nutritionBasis ?? 'per_recipe');
      setRecipeServingsCount(meal?.recipeServingsCount ?? 1);
      setDefaultPortionName(meal?.defaultPortionName ?? '');
      setServingGrams(meal?.servingGrams ?? 100);
    };
    syncFromMeal();
  }, [meal]);

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setMealOptionsMenuVisible(false);
        setDeleteMealConfirmVisible(false);
      };
      reset();
    }
  }, [visible]);

  useEffect(() => {
    // When opening the modal in create mode with initialFoods, prefill ingredients.
    if (visible && !meal) {
      if (!initialFoods || initialFoods.length === 0) {
        setIngredients([]);
        return;
      }

      let cancelled = false;

      Promise.all(
        initialFoods.map((item: { food: Food; amount: number }) =>
          buildIngredientFromFood(item.food, item.amount, t)
        )
      )
        .then((newIngredients) => {
          if (!cancelled) {
            setIngredients(newIngredients);
          }
        })
        .catch((error) => {
          handleError(error, 'CreateMealModal.prefillIngredients', {
            showSnackbar: false,
          });
        });

      return () => {
        cancelled = true;
      };
    }
  }, [visible, initialFoods, meal, setIngredients, t]);

  useEffect(() => {
    if (visible && isQuickTrack && logDate) {
      const syncDate = () => {
        setSelectedDate(localCalendarDayDate(logDate));
      };
      syncDate();
    }
  }, [visible, isQuickTrack, logDate]);

  // Calculate total macros from ingredients
  const totalMacros = useMemo(() => {
    return ingredients.reduce(
      (acc, ingredient) => ({
        calories: acc.calories + ingredient.calories,
        protein: acc.protein + ingredient.protein,
        carbs: acc.carbs + ingredient.carbs,
        fat: acc.fat + ingredient.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [ingredients]);

  const totalAdditionalNutrition = useMemo(() => {
    return ingredients.reduce(
      (acc, ingredient) => ({
        fiber: acc.fiber + ingredient.fiber,
        sugar: acc.sugar + (ingredient.sugar ?? 0),
        saturatedFat: acc.saturatedFat + (ingredient.saturatedFat ?? 0),
        sodium: acc.sodium + (ingredient.sodium ?? 0),
        alcohol: acc.alcohol + (ingredient.alcohol ?? 0),
        potassium: acc.potassium + (ingredient.potassium ?? 0),
        magnesium: acc.magnesium + (ingredient.magnesium ?? 0),
        zinc: acc.zinc + (ingredient.zinc ?? 0),
      }),
      {
        fiber: 0,
        sugar: 0,
        saturatedFat: 0,
        sodium: 0,
        alcohol: 0,
        potassium: 0,
        magnesium: 0,
        zinc: 0,
      }
    );
  }, [ingredients]);

  // Total meal weight in grams (sum of raw ingredients)
  const totalMealGrams = useMemo(
    () => ingredients.reduce((sum, ing) => sum + ing.referenceGrams, 0),
    [ingredients]
  );

  // Reference grams for scaling: prepared weight if set, otherwise raw ingredient sum
  const referenceMealGrams = preparedWeightGrams ?? totalMealGrams;

  useEffect(() => {
    if (!isQuickTrack) {
      return;
    }

    const syncAmount = () => {
      if (nutritionBasis === 'per_recipe') {
        setMealAmountGrams(referenceMealGrams);
      } else {
        setMealAmountGrams(1);
      }
    };
    syncAmount();
  }, [isQuickTrack, nutritionBasis, referenceMealGrams]);

  const quickTrackScale = useMemo(() => {
    if (!isQuickTrack) {
      return 1;
    }

    if (nutritionBasis === 'per_serving') {
      return Math.max(0.01, mealAmountGrams) / Math.max(1, recipeServingsCount);
    }

    if (nutritionBasis === 'per_gram') {
      return referenceMealGrams > 0
        ? (Math.max(0.01, mealAmountGrams) * Math.max(1, servingGrams)) / referenceMealGrams
        : 1;
    }

    return referenceMealGrams > 0 ? mealAmountGrams / referenceMealGrams : 1;
  }, [
    isQuickTrack,
    mealAmountGrams,
    nutritionBasis,
    recipeServingsCount,
    referenceMealGrams,
    servingGrams,
  ]);

  const displayedMealTotals = useMemo(() => {
    if (isQuickTrack) {
      return {
        calories: totalMacros.calories * quickTrackScale,
        protein: totalMacros.protein * quickTrackScale,
        carbs: totalMacros.carbs * quickTrackScale,
        fat: totalMacros.fat * quickTrackScale,
      };
    }

    return totalMacros;
  }, [isQuickTrack, quickTrackScale, totalMacros]);

  const displayedAdditionalNutrition = useMemo(() => {
    if (isQuickTrack) {
      return {
        fiber: totalAdditionalNutrition.fiber * quickTrackScale,
        sugar: totalAdditionalNutrition.sugar * quickTrackScale,
        saturatedFat: totalAdditionalNutrition.saturatedFat * quickTrackScale,
        sodium: totalAdditionalNutrition.sodium * quickTrackScale,
        alcohol: totalAdditionalNutrition.alcohol * quickTrackScale,
        potassium: totalAdditionalNutrition.potassium * quickTrackScale,
        magnesium: totalAdditionalNutrition.magnesium * quickTrackScale,
        zinc: totalAdditionalNutrition.zinc * quickTrackScale,
      };
    }

    return totalAdditionalNutrition;
  }, [isQuickTrack, quickTrackScale, totalAdditionalNutrition]);

  const mealNutritionCardFood = useMemo(
    () => ({
      name: mealName.trim() || t('food.createMeal.totalNutrition'),
      category:
        mealDescription.trim() || t('food.createMeal.ingredients', { count: ingredients.length }),
      calories: displayedMealTotals.calories,
      protein: displayedMealTotals.protein,
      carbs: displayedMealTotals.carbs,
      fat: displayedMealTotals.fat,
    }),
    [displayedMealTotals, ingredients.length, mealDescription, mealName, t]
  );

  const handleRemoveIngredient = (ingredientId: string) => {
    setIngredientToRemoveId(ingredientId);
    setIsConfirmationModalVisible(true);
  };

  const confirmRemoveIngredient = () => {
    if (ingredientToRemoveId) {
      removeIngredient(ingredientToRemoveId);
      setIngredientToRemoveId(null);
      setIsConfirmationModalVisible(false);
    }
  };

  const cancelRemoveIngredient = () => {
    setIngredientToRemoveId(null);
    setIsConfirmationModalVisible(false);
  };

  const handleConfirmDeleteMeal = async () => {
    if (!meal) {
      return;
    }

    setIsDeletingMeal(true);
    try {
      if (meal.imageUrl) {
        await deleteMealImage(meal.imageUrl);
      }
      await MealService.deleteMeal(meal.id);
      onSave?.();
      onClose();
    } catch (error) {
      handleError(error, 'CreateMealModal.handleDeleteMeal', {
        snackbarMessage: t('common.deleteFailed'),
      });
    } finally {
      setIsDeletingMeal(false);
    }
  };

  const syncMealPortion = async (targetMeal: Meal) => {
    await FoodPortionService.clearMealPortions(targetMeal.id);

    if (nutritionBasis === 'per_recipe') {
      return;
    }

    const trimmedPortionName =
      defaultPortionName.trim() || mealName.trim() || t('food.foodDetails.serving');

    if (nutritionBasis === 'per_serving') {
      const portion = await FoodPortionService.createPrivateNamedPortion(
        trimmedPortionName,
        'meal',
        targetMeal.id
      );
      await FoodPortionService.addPortionToMeal(targetMeal.id, portion.id, true);
      return;
    }

    if (nutritionBasis === 'per_gram') {
      const portion = await FoodPortionService.createFoodPortion(
        trimmedPortionName,
        Math.max(1, servingGrams),
        undefined,
        'custom',
        {
          kind: 'mass',
          scope: 'private',
          ownerType: 'meal',
          ownerId: targetMeal.id,
          dedupe: false,
        }
      );
      await FoodPortionService.addPortionToMeal(targetMeal.id, portion.id, true);
    }
  };

  const handleTrack = async () => {
    if (ingredients.length === 0) {
      showSnackbar('error', t('food.quickTrackMeal.addOneIngredient'));
      return;
    }
    if (saveToMyMeals && !mealName.trim()) {
      showSnackbar('error', t('food.quickTrackMeal.mealNameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      if (saveToMyMeals) {
        const savedMeal = await MealService.createMealFromFoods(
          mealName.trim(),
          ingredients.map((ing) => ({ foodId: ing.foodId, amount: ing.amount })),
          mealDescription.trim(),
          false,
          undefined,
          {
            nutritionBasis,
            recipeServingsCount,
            defaultPortionName:
              nutritionBasis === 'per_recipe' ? undefined : defaultPortionName.trim(),
            servingGrams: nutritionBasis === 'per_gram' ? Math.max(1, servingGrams) : undefined,
          }
        );
        await syncMealPortion(savedMeal);
      }

      // Non-interactive quick-track: stamp the chosen day with the current time
      // (shared across ingredients so they group at the same instant).
      const loggedDateTime = withCurrentTimeOnDay(selectedDate);
      for (const ing of ingredients) {
        await NutritionService.logFood(
          ing.foodId,
          loggedDateTime,
          selectedMealType,
          ing.amount * quickTrackScale,
          undefined
        );
      }
      onTracked?.();
      onFirstNutritionLog?.();
      if (saveToMyMeals) {
        onFirstMealCreated?.();
      }
      onClose();
      showSnackbar('success', t('food.quickTrackMeal.successMessage'));
    } catch (error) {
      handleError(error, 'CreateMealModal.handleTrack', {
        snackbarMessage: t('food.quickTrackMeal.errorMessage'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        // Force the legacy Android picker (`ACTION_GET_CONTENT`) instead of the modern system
        legacy: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        // Save to permanent storage immediately
        const permanentUri = await saveMealImage(result.assets[0].uri, imageUrl);
        setImageUrl(permanentUri);
      }
    } catch (error) {
      handleError(error, 'CreateMealModal.handlePickImage', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    }
  };

  const handleRemoveImage = async () => {
    if (imageUrl) {
      await deleteMealImage(imageUrl);
    }
    setImageUrl(undefined);
  };

  const handleSave = async () => {
    // Validate meal name
    if (!mealName.trim()) {
      showSnackbar('error', t('food.createMeal.mealNameRequired'));
      return;
    }

    // Validate ingredients
    if (ingredients.length === 0) {
      showSnackbar('error', t('food.createMeal.ingredientsRequired'));
      return;
    }

    setIsSaving(true);
    try {
      if (meal) {
        // Edit mode: update name, remove deleted foods, add new foods
        await MealService.updateMeal(meal.id, {
          name: mealName.trim(),
          description: mealDescription.trim(),
          imageUrl: imageUrl || null,
          preparedWeightGrams: preparedWeightGrams || null,
          nutritionBasis,
          recipeServingsCount,
          defaultPortionName: nutritionBasis === 'per_recipe' ? null : defaultPortionName.trim(),
          servingGrams: nutritionBasis === 'per_gram' ? Math.max(1, servingGrams) : null,
        });
        for (const mealFoodId of removedMealFoodIdsRef.current) {
          await MealService.removeFoodFromMeal(mealFoodId);
        }
        const newIngredients = ingredients.filter((ing) => !ing.mealFoodId);
        for (const ing of newIngredients) {
          await MealService.addFoodToMeal(meal.id, ing.foodId, ing.amount);
        }

        await assertSavedMealIntegrity(
          meal.id,
          ingredients.length,
          'CreateMealModal.handleSave.edit'
        );

        await syncMealPortion(meal);
      } else {
        // Create mode
        const savedMeal = await MealService.createMealFromFoods(
          mealName.trim(),
          ingredients.map((ing) => ({
            foodId: ing.foodId,
            amount: ing.amount,
          })),
          mealDescription.trim(),
          false,
          preparedWeightGrams || undefined,
          {
            imageUrl,
            nutritionBasis,
            recipeServingsCount,
            defaultPortionName:
              nutritionBasis === 'per_recipe' ? undefined : defaultPortionName.trim(),
            servingGrams: nutritionBasis === 'per_gram' ? Math.max(1, servingGrams) : undefined,
          }
        );

        await syncMealPortion(savedMeal);
      }

      onFirstMealCreated?.();

      // Callback to refresh meals list
      onSave?.();

      // Close modal
      onClose();
    } catch (error) {
      handleError(error, 'CreateMealModal.handleSave', {
        snackbarMessage: t('food.createMeal.saveFailed'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const removeIngredient = (ingredientId: string) => {
    setIngredients((prev) => {
      const toRemove = prev.find((item) => item.localId === ingredientId);
      if (toRemove?.mealFoodId) {
        removedMealFoodIdsRef.current.push(toRemove.mealFoodId);
      }

      return prev.filter((item) => item.localId !== ingredientId);
    });
  };

  const getSaveLabel = () => {
    if (isSaving) {
      return t('common.saving');
    }
    if (isQuickTrack) {
      return t('food.quickTrackMeal.trackMeal');
    }
    if (meal) {
      return t('common.save');
    }
    return t('food.createMeal.saveMeal');
  };

  const getTitle = () => {
    if (isQuickTrack) {
      return t('food.quickTrackMeal.title');
    }

    if (meal) {
      return t('food.meals.manageMealData.editMeal');
    }

    return t('food.createMeal.title');
  };

  const getSaveIcon = () => {
    if (isSaving) {
      return undefined;
    }

    if (isQuickTrack) {
      return Check;
    }

    return CheckCircle2;
  };

  const mealTypeOptions = useMemo(() => getMealTypeOptions(theme, t), [theme, t]);

  const handleAddFoods = async (selectedFoods: { food: Food; amount: number }[]) => {
    try {
      const newIngredients = await Promise.all(
        selectedFoods.map((item) => buildIngredientFromFood(item.food, item.amount, t))
      );
      setIngredients((prev) => [...prev, ...newIngredients]);
      setIsAddFoodVisible(false);
    } catch (error) {
      handleError(error, 'CreateMealModal.handleAddFoods', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={getTitle()}
      headerRight={
        !isQuickTrack && meal ? (
          <MenuButton size="md" className="p-2" onPress={() => setMealOptionsMenuVisible(true)} />
        ) : undefined
      }
      footer={
        <View className="px-4 pb-8 pt-2">
          <Button
            label={getSaveLabel()}
            variant="gradientCta"
            size="md"
            width="full"
            icon={getSaveIcon()}
            onPress={isQuickTrack ? handleTrack : handleSave}
            disabled={
              isSaving ||
              (isQuickTrack &&
                (ingredients.length === 0 ||
                  mealAmountGrams < (nutritionBasis === 'per_recipe' ? 1 : 0.5)))
            }
          />
          {isSaving ? (
            <View
              style={{
                position: 'absolute',
                right: theme.spacing.padding.xl,
                top: theme.spacing.padding.lg,
              }}
            >
              <ActivityIndicator size="small" color={theme.colors.text.black} />
            </View>
          ) : null}
        </View>
      }
    >
      <View className="flex-1 px-4 py-6">
        {/* Meal Name Input Section (create/edit only) */}
        {!isQuickTrack ? (
          <View className="mb-6">
            <TextInput
              label={t('food.createMeal.mealName')}
              value={mealName}
              onChangeText={setMealName}
              placeholder={t('food.createMeal.mealNamePlaceholder')}
            />

            {/* Meal Image Picker Section */}
            <View style={{ marginTop: theme.spacing.margin.lg }}>
              <Text className="mb-2 ml-1 text-sm font-medium text-text-secondary">
                {t('common.photo')}
              </Text>
              {imageUrl ? (
                <View className="relative h-48 w-full overflow-hidden rounded-2xl">
                  <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
                  <View className="absolute bottom-2 right-2 flex-row gap-2">
                    <Pressable
                      onPress={handlePickImage}
                      style={{
                        width: 40,
                        height: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: theme.borderRadius.lg,
                        backgroundColor: theme.colors.background.overlay,
                        borderWidth: theme.borderWidth.thin,
                        borderColor: theme.colors.border.default,
                      }}
                    >
                      <Camera size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
                    </Pressable>
                    <Pressable
                      onPress={handleRemoveImage}
                      style={{
                        width: 40,
                        height: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: theme.borderRadius.lg,
                        backgroundColor: theme.colors.background.overlay,
                        borderWidth: theme.borderWidth.thin,
                        borderColor: theme.colors.border.default,
                      }}
                    >
                      <Trash2 size={theme.iconSize.sm} color={theme.colors.status.error} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={handlePickImage}
                  className="h-32 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/5"
                >
                  <Camera size={theme.iconSize.xl} color={theme.colors.text.tertiary} />
                  <Text className="mt-2 text-sm text-text-tertiary">
                    {t('food.createMeal.addPhoto')}
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={{ marginTop: theme.spacing.margin.lg }}>
              <TextInput
                label={t('common.description')}
                value={mealDescription}
                onChangeText={setMealDescription}
                placeholder={t('food.createMeal.mealDescriptionPlaceholder')}
                multiline
                numberOfLines={4}
                selectTextOnFocus={false}
              />
            </View>
          </View>
        ) : null}

        <FoodNutritionSectionCard
          food={mealNutritionCardFood}
          canEdit={false}
          mode="meal"
          nutritionalData={displayedAdditionalNutrition}
          servingSize={100}
          isLoadingDetails={false}
          intuitiveMode={intuitiveEatingMode}
          showName={false}
        />

        <View className="mb-6 mt-6 gap-4">
          <Text className="text-sm font-medium text-text-secondary">
            {t('food.foodDetails.serving')}
          </Text>
          <FilterTabs
            tabs={[
              {
                id: 'per_recipe',
                label: t('food.foodDetails.perRecipe'),
              },
              {
                id: 'per_serving',
                label: t('food.foodDetails.perServing'),
              },
              {
                id: 'per_gram',
                label: t('food.foodDetails.byGrams'),
              },
            ]}
            activeTab={nutritionBasis}
            onTabChange={(id) => setNutritionBasis(id as 'per_recipe' | 'per_serving' | 'per_gram')}
            showContainer={false}
          />
          {nutritionBasis === 'per_serving' || nutritionBasis === 'per_gram' ? (
            <>
              <TextInput
                label={t('food.foodDetails.servingName')}
                value={defaultPortionName}
                onChangeText={setDefaultPortionName}
                placeholder={t('food.foodDetails.servingNamePlaceholder')}
              />
              {nutritionBasis === 'per_serving' ? (
                <StepperInput
                  label={t('food.foodDetails.recipeServings')}
                  value={recipeServingsCount}
                  maxFractionDigits={0}
                  onIncrement={() => setRecipeServingsCount((prev) => prev + 1)}
                  onDecrement={() => setRecipeServingsCount((prev) => Math.max(1, prev - 1))}
                  onChangeValue={(value) => setRecipeServingsCount(Math.max(1, Math.round(value)))}
                />
              ) : (
                <StepperInput
                  label={t('food.foodDetails.servingWeight', {
                    unit: massUnit,
                  })}
                  value={gramsToDisplay(servingGrams, units)}
                  onIncrement={() =>
                    setServingGrams((prev) => Math.max(1, Math.round(prev + stepAmount)))
                  }
                  onDecrement={() =>
                    setServingGrams((prev) => Math.max(1, Math.round(prev - stepAmount)))
                  }
                  onChangeValue={(displayVal) =>
                    setServingGrams(Math.max(1, Math.round(displayToGrams(displayVal, units))))
                  }
                  unit={massUnit}
                  step={stepDisplay}
                  maxFractionDigits={units === 'imperial' ? 1 : 0}
                />
              )}
            </>
          ) : null}
        </View>

        {/* Ingredients Section */}
        <View className="mb-6 mt-6">
          <View className="mb-3 flex-row items-end justify-between px-1">
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: theme.typography.letterSpacing.extraWide,
              }}
            >
              {t('food.createMeal.ingredients', { count: ingredients.length })}
            </Text>
          </View>

          <View style={{ gap: theme.spacing.gap.md }}>
            {ingredients.length === 0 ? (
              <View
                style={{
                  padding: theme.spacing.padding.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.text.tertiary,
                    textAlign: 'center',
                  }}
                >
                  {t('food.createMeal.noIngredients')}
                </Text>
              </View>
            ) : (
              ingredients.map((item) => (
                <View
                  key={item.localId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.colors.background.card,
                    padding: theme.spacing.padding.md,
                    borderRadius: theme.borderRadius.md,
                    borderWidth: theme.borderWidth.thin,
                    borderColor: theme.colors.border.light,
                  }}
                >
                  <View
                    style={{
                      width: theme.iconSize['5xl'],
                      height: theme.iconSize['5xl'],
                      borderRadius: theme.spacing.padding['2half'],
                      backgroundColor: theme.colors.background.secondaryDark,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: theme.borderWidth.thin,
                      borderColor: theme.colors.border.light,
                      marginRight: theme.spacing.padding.md,
                    }}
                  >
                    <Apple size={theme.iconSize.lg} color={theme.colors.text.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: theme.typography.fontSize.sm,
                        fontWeight: theme.typography.fontWeight.bold,
                        color: theme.colors.text.primary,
                      }}
                    >
                      {item.name}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.gap.sm,
                        marginTop: theme.size.xs / 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: theme.typography.fontSize.xs,
                          color: theme.colors.text.secondary,
                        }}
                      >
                        {item.isPerServing
                          ? `${formatRoundedDecimal(item.amount, 2)} ${t('food.foodDetails.serving')}`
                          : `${formatInteger(Math.round(item.amount))}g`}
                      </Text>
                      <View
                        style={{
                          width: theme.size.xs,
                          height: theme.size.xs,
                          borderRadius: theme.size.xs / 4,
                          backgroundColor: theme.colors.text.tertiary,
                        }}
                      />
                      <Text
                        style={[
                          {
                            fontSize: theme.typography.fontSize.xs,
                            color: theme.colors.text.secondary,
                          },
                          intuitiveEatingMode ? blurFilter(4) : undefined,
                        ]}
                      >
                        {intuitiveEatingMode ? '0' : formatRoundedDecimal(item.calories, 2)}{' '}
                        {t('common.kcal')}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => handleRemoveIngredient(item.localId)} className="p-2">
                    <Trash2 size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
                  </Pressable>
                </View>
              ))
            )}

            <Button
              variant="dashed"
              size="sm"
              width="full"
              icon={Plus}
              iconBgColor={theme.colors.background.secondaryDark}
              label={
                isQuickTrack
                  ? t('food.quickTrackMeal.addIngredient')
                  : t('food.createMeal.addFoodItem')
              }
              onPress={() => setIsAddFoodVisible(true)}
              style={{ marginTop: theme.spacing.padding.sm }}
            />
          </View>
        </View>

        {/* Prepared weight input (create/edit mode only) */}
        {!isQuickTrack ? (
          <View className="mb-6">
            <StepperInput
              label={t('food.createMeal.preparedWeight', { unit: massUnit })}
              value={gramsToDisplay(preparedWeightGrams ?? totalMealGrams, units)}
              onIncrement={() => {
                const current = preparedWeightGrams ?? totalMealGrams;
                const next = Math.round(current + stepAmount);
                setPreparedWeightGrams(next > 0 ? next : undefined);
              }}
              onDecrement={() => {
                const current = preparedWeightGrams ?? totalMealGrams;
                const next = Math.round(current - stepAmount);
                setPreparedWeightGrams(next > 0 ? next : undefined);
              }}
              onChangeValue={(displayVal) => {
                const grams = Math.round(displayToGrams(displayVal, units));
                setPreparedWeightGrams(grams > 0 ? grams : undefined);
              }}
              unit={massUnit}
              step={stepDisplay}
              maxFractionDigits={units === 'imperial' ? 1 : 0}
            />
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.secondary,
                marginTop: theme.spacing.padding.sm,
              }}
            >
              {t('food.createMeal.preparedWeightHelper')}
            </Text>
          </View>
        ) : null}

        {/* Quick Track: Serving size (grams), date, meal type, save toggle, optional meal name */}
        {isQuickTrack ? (
          <>
            <View style={{ marginBottom: theme.spacing.margin.xl }}>
              {nutritionBasis === 'per_serving' || nutritionBasis === 'per_gram' ? (
                <StepperInput
                  label={t('food.foodDetails.servings')}
                  value={mealAmountGrams}
                  step={0.5}
                  maxFractionDigits={2}
                  onIncrement={() => setMealAmountGrams((prev) => prev + 0.5)}
                  onDecrement={() => setMealAmountGrams((prev) => Math.max(0.5, prev - 0.5))}
                  onChangeValue={setMealAmountGrams}
                  unit={defaultPortionName.trim() || t('food.foodDetails.serving')}
                />
              ) : (
                <ServingSizeSelector
                  value={mealAmountGrams}
                  onChange={(v) => setMealAmountGrams(Math.round(v))}
                  quickSizes={
                    referenceMealGrams > 0
                      ? [
                          { label: '½×', value: Math.round(referenceMealGrams * 0.5) },
                          { label: '1×', value: referenceMealGrams },
                          { label: '1½×', value: Math.round(referenceMealGrams * 1.5) },
                          { label: '2×', value: referenceMealGrams * 2 },
                        ]
                      : []
                  }
                />
              )}
            </View>
            <View className="mb-6">
              <DatePickerInput
                label={t('food.quickTrackMeal.date')}
                selectedDate={selectedDate}
                onPress={() => setShowDatePicker(true)}
                variant="default"
              />
            </View>

            <View className="mb-6">
              <OptionsSelector<MealType>
                title={t('food.quickTrackMeal.mealType')}
                options={mealTypeOptions}
                selectedId={selectedMealType}
                onSelect={setSelectedMealType}
              />
            </View>

            <View
              className="mb-6"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: theme.spacing.padding.md,
                backgroundColor: theme.colors.background.card,
                borderRadius: theme.borderRadius.lg,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.border.light,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.colors.text.primary,
                  }}
                >
                  {t('food.quickTrackMeal.saveToMyMeals')}
                </Text>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.text.secondary,
                    marginTop: theme.spacing.padding.xsHalf,
                  }}
                >
                  {t('food.quickTrackMeal.saveToMyMealsDescription')}
                </Text>
              </View>
              <Switch
                value={saveToMyMeals}
                onValueChange={setSaveToMyMeals}
                trackColor={{
                  false: theme.colors.background.white10,
                  true: theme.colors.accent.primary40,
                }}
                thumbColor={
                  saveToMyMeals ? theme.colors.accent.primary : theme.colors.text.tertiary
                }
              />
            </View>

            {saveToMyMeals ? (
              <View className="mb-6">
                <TextInput
                  label={t('food.quickTrackMeal.mealName')}
                  value={mealName}
                  onChangeText={setMealName}
                  placeholder={t('food.quickTrackMeal.mealNamePlaceholder')}
                />
                <View style={{ marginTop: theme.spacing.margin.lg }}>
                  <TextInput
                    label={t('common.description')}
                    value={mealDescription}
                    onChangeText={setMealDescription}
                    placeholder={t('food.createMeal.mealDescriptionPlaceholder')}
                    multiline
                    numberOfLines={4}
                    selectTextOnFocus={false}
                  />
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {isAddFoodVisible ? (
        <AddFoodItemToMealModal
          visible={isAddFoodVisible}
          onClose={() => setIsAddFoodVisible(false)}
          onAddFoods={handleAddFoods}
        />
      ) : null}

      {!isQuickTrack && meal ? (
        <BottomPopUpMenu
          visible={mealOptionsMenuVisible}
          onClose={() => setMealOptionsMenuVisible(false)}
          title={t('food.meals.manageMealData.mealOptions')}
          items={[
            {
              icon: Trash2,
              iconColor: theme.colors.status.error,
              iconBgColor: theme.colors.status.error20,
              title: t('food.meals.manageMealData.deleteMeal'),
              description: t('food.meals.manageMealData.deleteMealDesc'),
              titleColor: theme.colors.status.error,
              onPress: () => {
                setMealOptionsMenuVisible(false);
                setDeleteMealConfirmVisible(true);
              },
            },
          ]}
        />
      ) : null}

      {isQuickTrack ? (
        <DatePickerModal
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          selectedDate={selectedDate}
          onDateSelect={(date) => {
            setSelectedDate(localCalendarDayDate(date));
            setShowDatePicker(false);
          }}
        />
      ) : null}
      <ConfirmationModal
        visible={isConfirmationModalVisible}
        onClose={cancelRemoveIngredient}
        onConfirm={confirmRemoveIngredient}
        title={t('food.createMeal.deleteIngredient')}
        message={t('food.createMeal.deleteIngredientWarning')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
      <ConfirmationModal
        visible={deleteMealConfirmVisible}
        onClose={() => setDeleteMealConfirmVisible(false)}
        onConfirm={handleConfirmDeleteMeal}
        title={t('food.meals.manageMealData.deleteMeal')}
        message={t('food.meals.manageMealData.deleteMealWarning')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="destructive"
        isLoading={isDeletingMeal}
      />
    </FullScreenModal>
  );
}
