import { Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { MealNutritionHighlightCard } from '@/components/cards/MealNutritionHighlightCard';
import { FilterTabs } from '@/components/FilterTabs';
import { Button } from '@/components/theme/Button';
import { StepperInput } from '@/components/theme/StepperInput';
import { TextInput } from '@/components/theme/TextInput';
import { useSnackbar } from '@/context/SnackbarContext';
import Food from '@/database/models/Food';
import Meal from '@/database/models/Meal';
import { FoodPortionService, MealService } from '@/database/services';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { handleError } from '@/utils/handleError';
import { displayToGrams, getMassUnitLabel, gramsToDisplay } from '@/utils/unitConversion';

import { AddFoodItemToMealModal } from './AddFoodItemToMealModal';
import { FullScreenModal } from './FullScreenModal';

type Ingredient = {
  localId: string;
  food: Food;
  amount: number;
};

type IngredientRowProps = {
  ingredient: Ingredient;
  amountLabel: string;
  caloriesLabel: string;
  kcalLabel: string;
  onRemove?: (localId: string) => void;
};

function IngredientRow({
  ingredient,
  amountLabel,
  caloriesLabel,
  kcalLabel,
  onRemove,
}: IngredientRowProps) {
  const theme = useTheme();
  return (
    <View
      className="flex-row items-center justify-between rounded-xl p-3"
      style={{ backgroundColor: theme.colors.background.cardElevated }}
    >
      <View className="flex-1 gap-0.5">
        <Text
          className="font-semibold"
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.typography.fontSize.sm,
          }}
          numberOfLines={1}
        >
          {ingredient.food.name}
        </Text>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: theme.typography.fontSize.xs,
          }}
        >
          {amountLabel}
          {' · '}
          {caloriesLabel} {kcalLabel}
        </Text>
      </View>
      {onRemove ? (
        <Pressable
          onPress={() => onRemove(ingredient.localId)}
          style={{ padding: theme.spacing.padding.sm }}
          hitSlop={8}
        >
          <Trash2 size={theme.iconSize.md} color={theme.colors.status.error} />
        </Pressable>
      ) : null}
    </View>
  );
}

type DynamicMealCreatorModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Called before closing when a meal is created for the first time, so the parent can trigger confetti. */
  onFirstMealCreated?: () => void;
};

export default function DynamicMealCreatorModal({
  visible,
  onClose,
  onSaved,
  onFirstMealCreated,
}: DynamicMealCreatorModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { units } = useSettings();

  const [step, setStep] = useState<'builder' | 'save'>('builder');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [addFoodModalVisible, setAddFoodModalVisible] = useState(false);

  const [mealName, setMealName] = useState('');
  const [mealDescription, setMealDescription] = useState('');
  const [preparedWeightGrams, setPreparedWeightGrams] = useState<number | undefined>(undefined);
  const [nutritionBasis, setNutritionBasis] = useState<'per_recipe' | 'per_serving' | 'per_gram'>(
    'per_recipe'
  );
  const [recipeServingsCount, setRecipeServingsCount] = useState(1);
  const [servingGrams, setServingGrams] = useState(100);
  const [defaultPortionName, setDefaultPortionName] = useState('');
  const [mealNameError, setMealNameError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const massUnit = getMassUnitLabel(units);
  const stepDisplay = units === 'imperial' ? 0.5 : 10;
  const stepAmount = units === 'imperial' ? displayToGrams(0.5, units) : 10;

  const NUTRITION_BASIS_TABS = [
    { id: 'per_recipe', label: t('food.foodDetails.perRecipe') },
    { id: 'per_serving', label: t('food.foodDetails.perServing') },
    { id: 'per_gram', label: t('food.foodDetails.byGrams') },
  ];

  const totals = useMemo(() => {
    return ingredients.reduce(
      (acc, { food, amount }) => {
        const isPerServing = food.resolvedNutritionBasis === 'per_serving';
        const factor = isPerServing ? amount : amount / 100;
        return {
          calories: acc.calories + (food.calories ?? 0) * factor,
          protein: acc.protein + (food.protein ?? 0) * factor,
          carbs: acc.carbs + (food.carbs ?? 0) * factor,
          fat: acc.fat + (food.fat ?? 0) * factor,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [ingredients]);

  const totalRawWeightGrams = useMemo(
    () =>
      Math.round(
        ingredients.reduce((sum, { food, amount }) => {
          return food.resolvedNutritionBasis === 'per_100g' ? sum + amount : sum;
        }, 0)
      ),
    [ingredients]
  );

  const handleAddFoods = useCallback((foods: { food: Food; amount: number }[]) => {
    const newIngredients: Ingredient[] = foods.map((item, idx) => ({
      localId: `${Date.now()}-${idx}`,
      food: item.food,
      amount: item.amount,
    }));
    setIngredients((prev) => [...prev, ...newIngredients]);
  }, []);

  const handleRemoveIngredient = useCallback((localId: string) => {
    setIngredients((prev) => {
      const removed = prev.find((i) => i.localId === localId);
      if (removed?.food.resolvedNutritionBasis === 'per_100g') {
        setPreparedWeightGrams((pw) => {
          if (pw == null) {
            return pw;
          }

          const next = Math.round(pw - removed.amount);
          return next > 0 ? next : undefined;
        });
      }

      return prev.filter((i) => i.localId !== localId);
    });
  }, []);

  const handleGoToSave = useCallback(() => {
    if (preparedWeightGrams === undefined && totalRawWeightGrams > 0) {
      setPreparedWeightGrams(totalRawWeightGrams);
    }
    setStep('save');
  }, [preparedWeightGrams, totalRawWeightGrams]);

  const syncMealPortion = useCallback(
    async (targetMeal: Meal) => {
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
    },
    [nutritionBasis, defaultPortionName, mealName, servingGrams, t]
  );

  const handleFinishAndSave = useCallback(async () => {
    if (!mealName.trim()) {
      setMealNameError(true);
      return;
    }

    setIsSaving(true);
    try {
      const savedMeal = await MealService.createMealFromFoods(
        mealName.trim(),
        ingredients.map(({ food, amount }) => ({ foodId: food.id, amount })),
        mealDescription.trim() || undefined,
        false,
        preparedWeightGrams,
        {
          nutritionBasis,
          recipeServingsCount,
          defaultPortionName:
            nutritionBasis === 'per_recipe' ? undefined : defaultPortionName.trim() || undefined,
          servingGrams: nutritionBasis === 'per_gram' ? Math.max(1, servingGrams) : undefined,
        }
      );

      await syncMealPortion(savedMeal);
      showSnackbar('success', t('meals.dynamicCreator.savedSuccess'));
      onFirstMealCreated?.();
      onSaved();
    } catch (error) {
      handleError(error, 'DynamicMealCreatorModal.handleFinishAndSave', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    mealName,
    ingredients,
    mealDescription,
    preparedWeightGrams,
    nutritionBasis,
    recipeServingsCount,
    defaultPortionName,
    servingGrams,
    syncMealPortion,
    showSnackbar,
    t,
    onFirstMealCreated,
    onSaved,
  ]);

  const handleClose = useCallback(() => {
    if (step === 'save') {
      setStep('builder');
    } else {
      onClose();
    }
  }, [step, onClose]);

  const handleMealNameChange = useCallback((text: string) => {
    setMealName(text);
    if (text.trim()) {
      setMealNameError(false);
    }
  }, []);

  const ingredientAmountLabel = (food: Food, amount: number) => {
    if (food.resolvedNutritionBasis === 'per_serving') {
      return `${formatRoundedDecimal(amount, 2)} ${t('food.foodDetails.serving')}`;
    }
    return `${formatRoundedDecimal(amount, 0)} g`;
  };

  const ingredientCalories = (food: Food, amount: number) => {
    const isPerServing = food.resolvedNutritionBasis === 'per_serving';
    const factor = isPerServing ? amount : amount / 100;
    return formatRoundedDecimal((food.calories ?? 0) * factor, 0);
  };

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={handleClose}
        scrollable={false}
        title={
          step === 'save'
            ? t('meals.dynamicCreator.saveMealTitle')
            : t('meals.dynamicCreator.title')
        }
        footer={
          step === 'builder' ? (
            <Button
              label={t('meals.dynamicCreator.finishAndSave')}
              variant={ingredients.length === 0 ? 'outline' : 'gradientCta'}
              size="md"
              width="full"
              disabled={ingredients.length === 0}
              onPress={handleGoToSave}
            />
          ) : (
            <Button
              label={t('meals.dynamicCreator.saveButton')}
              variant="gradientCta"
              size="md"
              width="full"
              loading={isSaving}
              disabled={isSaving}
              onPress={handleFinishAndSave}
            />
          )
        }
      >
        {step === 'builder' ? (
          <View className="flex-1 px-4 pt-4">
            {/* Nutrition summary */}
            {ingredients.length > 0 ? (
              <View className="mb-4">
                <MealNutritionHighlightCard
                  caption={t('meals.dynamicCreator.totalNutrition')}
                  calories={totals.calories}
                  protein={totals.protein}
                  carbs={totals.carbs}
                  fat={totals.fat}
                />
              </View>
            ) : null}

            {/* Ingredient list */}
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {ingredients.length === 0 ? (
                <View className="items-center justify-center py-12">
                  <Text
                    className="text-center"
                    style={{
                      color: theme.colors.text.secondary,
                      fontSize: theme.typography.fontSize.sm,
                    }}
                  >
                    {t('meals.dynamicCreator.noIngredients')}
                  </Text>
                </View>
              ) : (
                <View className="gap-2 pb-4">
                  {ingredients.map((ingredient) => (
                    <IngredientRow
                      key={ingredient.localId}
                      ingredient={ingredient}
                      amountLabel={ingredientAmountLabel(ingredient.food, ingredient.amount)}
                      caloriesLabel={ingredientCalories(ingredient.food, ingredient.amount)}
                      kcalLabel={t('common.kcal')}
                      onRemove={handleRemoveIngredient}
                    />
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Add food button */}
            <View className="py-4">
              <Button
                label={t('meals.dynamicCreator.addFood')}
                variant="secondary"
                size="md"
                width="full"
                onPress={() => setAddFoodModalVisible(true)}
              />
            </View>
          </View>
        ) : (
          <KeyboardAwareScrollView
            className="flex-1"
            contentContainerStyle={{ padding: theme.spacing.padding.xl, gap: theme.spacing.gap.xl }}
            showsVerticalScrollIndicator={false}
            bottomOffset={16}
          >
            {/* Nutrition recap */}
            <MealNutritionHighlightCard
              caption={t('meals.dynamicCreator.ingredientsSummary', { count: ingredients.length })}
              calories={totals.calories}
              protein={totals.protein}
              carbs={totals.carbs}
              fat={totals.fat}
            />

            {/* Ingredient recap list */}
            <View className="gap-1.5">
              {ingredients.map((ingredient) => (
                <IngredientRow
                  key={ingredient.localId}
                  ingredient={ingredient}
                  amountLabel={ingredientAmountLabel(ingredient.food, ingredient.amount)}
                  caloriesLabel={ingredientCalories(ingredient.food, ingredient.amount)}
                  kcalLabel={t('common.kcal')}
                  onRemove={handleRemoveIngredient}
                />
              ))}
            </View>

            {/* Meal name */}
            <View className="gap-1">
              <TextInput
                label={t('meals.dynamicCreator.mealNameLabel')}
                value={mealName}
                onChangeText={handleMealNameChange}
                placeholder={t('meals.dynamicCreator.mealNamePlaceholder')}
              />
              {mealNameError ? (
                <Text
                  style={{
                    color: theme.colors.status.error,
                    fontSize: theme.typography.fontSize.xs,
                    paddingHorizontal: theme.spacing.padding.sm,
                  }}
                >
                  {t('meals.dynamicCreator.mealNameRequired')}
                </Text>
              ) : null}
            </View>

            {/* Description */}
            <TextInput
              label={t('meals.dynamicCreator.descriptionLabel')}
              value={mealDescription}
              onChangeText={setMealDescription}
              placeholder={t('meals.dynamicCreator.descriptionPlaceholder')}
              multiline
            />

            {/* Portion creation */}
            <View className="gap-4">
              <Text className="text-sm font-medium text-text-secondary">
                {t('food.foodDetails.serving')}
              </Text>
              <FilterTabs
                tabs={NUTRITION_BASIS_TABS}
                activeTab={nutritionBasis}
                onTabChange={(id) =>
                  setNutritionBasis(id as 'per_recipe' | 'per_serving' | 'per_gram')
                }
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
                      onChangeValue={(v) => setRecipeServingsCount(Math.max(1, Math.round(v)))}
                      onIncrement={() => setRecipeServingsCount((prev) => prev + 1)}
                      onDecrement={() => setRecipeServingsCount((prev) => Math.max(1, prev - 1))}
                    />
                  ) : (
                    <StepperInput
                      label={t('food.foodDetails.servingWeight', { unit: massUnit })}
                      value={gramsToDisplay(servingGrams, units)}
                      step={stepDisplay}
                      maxFractionDigits={units === 'imperial' ? 1 : 0}
                      onChangeValue={(displayVal) =>
                        setServingGrams(Math.max(1, Math.round(displayToGrams(displayVal, units))))
                      }
                      onIncrement={() =>
                        setServingGrams((prev) => Math.max(1, Math.round(prev + stepAmount)))
                      }
                      onDecrement={() =>
                        setServingGrams((prev) => Math.max(1, Math.round(prev - stepAmount)))
                      }
                      unit={massUnit}
                    />
                  )}
                </>
              ) : null}
            </View>
            <View className="mb-6">
              {/* Prepared weight */}
              <StepperInput
                label={t('food.createMeal.preparedWeight', { unit: massUnit })}
                value={preparedWeightGrams ?? 0}
                step={10}
                maxFractionDigits={0}
                onChangeValue={(v) => setPreparedWeightGrams(v > 0 ? Math.round(v) : undefined)}
                onIncrement={() => setPreparedWeightGrams((prev) => (prev ?? 0) + 10)}
                onDecrement={() =>
                  setPreparedWeightGrams((prev) =>
                    prev != null && prev > 10 ? prev - 10 : undefined
                  )
                }
                unit={massUnit}
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
            {/* Bottom spacing for footer */}
            <View style={{ height: theme.size['20'] }} />
          </KeyboardAwareScrollView>
        )}
      </FullScreenModal>

      {addFoodModalVisible ? (
        <AddFoodItemToMealModal
          visible={addFoodModalVisible}
          onClose={() => setAddFoodModalVisible(false)}
          onAddFoods={(foods) => {
            handleAddFoods(foods);
            setAddFoodModalVisible(false);
          }}
        />
      ) : null}
    </>
  );
}
