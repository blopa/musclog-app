import type { TFunction } from 'i18next';
import {
  Apple,
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
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
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
import { MealService, NutritionService } from '@/database/services';
import { type Ingredient, useEditMealIngredients } from '@/hooks/useEditMealIngredients';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';
import { blurFilter } from '@/utils/blurFilter';
import { localCalendarDayDate } from '@/utils/calendarDate';
import { captureException } from '@/utils/sentry';
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
};

const MacroCard = ({
  label,
  value,
  progress,
  color,
  intuitiveMode = false,
}: {
  label: string;
  value: string;
  progress: number;
  color: string;
  intuitiveMode?: boolean;
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.overlay.backdrop,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.padding['2half'],
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border.light,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: theme.typography.letterSpacing.wider,
          marginBottom: theme.spacing.padding.xsHalf,
        }}
      >
        {label}
      </Text>
      <Text
        style={[
          {
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.primary,
          },
          intuitiveMode ? blurFilter(4) : undefined,
        ]}
      >
        {intuitiveMode ? t('common.weightFormatG', { value: 0 }) : value}
      </Text>
      <View
        style={{
          width: '100%',
          height: theme.size.xs,
          backgroundColor: theme.colors.background.white10,
          borderRadius: theme.borderRadius.xs / 2,
          marginTop: theme.spacing.padding.sm,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: intuitiveMode ? '0%' : `${progress}%`,
            backgroundColor: color,
            borderRadius: theme.borderRadius.xs / 2,
          }}
        />
      </View>
    </View>
  );
};

// Local component for Meal Macros Summary
const MealMacrosSummary = ({
  calories,
  macros,
  intuitiveMode = false,
}: {
  calories: number;
  macros: { protein: number; carbs: number; fat: number };
  intuitiveMode?: boolean;
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { width: windowWidth } = useWindowDimensions();

  // Calculate progress percentages (simple estimation)
  const proteinProgress = Math.min((macros.protein / 100) * 100, 100);
  const carbsProgress = Math.min((macros.carbs / 150) * 100, 100);
  const fatProgress = Math.min((macros.fat / 80) * 100, 100);

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.cardElevated,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.padding.lg,
        marginBottom: theme.spacing.margin.xl,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border.light,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Glows */}
      <View
        style={{
          position: 'absolute',
          top: theme.offset.glowMedium,
          right: theme.offset.glowMedium,
          width: theme.size['160'],
          height: theme.size['160'],
          backgroundColor: theme.colors.accent.primary20,
          borderRadius: theme.size['20'] * 4,
          opacity: theme.colors.opacity.medium,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: theme.offset.glowMedium,
          left: theme.offset.glowMedium,
          width: theme.size['160'],
          height: theme.size['160'],
          backgroundColor: theme.colors.status.indigo20,
          borderRadius: theme.size['20'] * 4,
          opacity: theme.colors.opacity.medium,
        }}
      />

      <View style={{ position: 'relative', zIndex: theme.zIndex.dropdown }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: theme.spacing.margin.lg,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.primary,
              }}
            >
              {t('food.createMeal.totalNutrition')}
            </Text>
            <Text
              style={[
                {
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text.secondary,
                },
                intuitiveMode ? blurFilter(4) : undefined,
              ]}
            >
              {intuitiveMode ? '0' : formatRoundedDecimal(calories, 2)} {t('common.kcal')}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: theme.colors.background.secondaryDark,
              paddingHorizontal: theme.spacing.padding['2half'],
              paddingVertical: theme.spacing.padding.xs,
              borderRadius: theme.borderRadius.full,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: theme.typography.letterSpacing.wider,
              }}
            >
              {t('food.createMeal.estimated')}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.gap.md }}>
          <MacroCard
            label={windowWidth < 380 ? t('food.macros.proteinShort') : t('food.macros.protein')}
            value={t('common.weightFormatG', {
              value: formatRoundedDecimal(macros.protein, 2),
            })}
            progress={proteinProgress}
            color={theme.colors.accent.primary}
            intuitiveMode={intuitiveMode}
          />
          <MacroCard
            label={windowWidth < 380 ? t('food.macros.carbsShort') : t('food.macros.carbs')}
            value={t('common.weightFormatG', {
              value: formatRoundedDecimal(macros.carbs, 2),
            })}
            progress={carbsProgress}
            color={theme.colors.status.indigo}
            intuitiveMode={intuitiveMode}
          />
          <MacroCard
            label={windowWidth < 380 ? t('food.macros.fatShort') : t('food.macros.fat')}
            value={t('common.weightFormatG', {
              value: formatRoundedDecimal(macros.fat, 2),
            })}
            progress={fatProgress}
            color={theme.colors.status.amber}
            intuitiveMode={intuitiveMode}
          />
        </View>
      </View>
    </View>
  );
};

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

  const isQuickTrack = mode === 'quickTrack';

  const { ingredients, setIngredients, removedMealFoodIdsRef } = useEditMealIngredients(
    isQuickTrack ? undefined : meal
  );

  useEffect(() => {
    setMealName(meal?.name ?? '');
    setMealDescription(meal?.description ?? '');
    setPreparedWeightGrams(meal?.preparedWeightGrams ?? undefined);
  }, [meal]);

  useEffect(() => {
    if (!visible) {
      setMealOptionsMenuVisible(false);
      setDeleteMealConfirmVisible(false);
    }
  }, [visible]);

  useEffect(() => {
    // When opening the modal in create mode with initialFoods, prefill ingredients.
    if (visible && initialFoods && initialFoods.length > 0 && !meal) {
      const newIngredients: Ingredient[] = initialFoods.map(
        (item: { food: Food; amount: number }) => {
          const multiplier = item.amount / 100;
          return {
            foodId: item.food.id,
            name: item.food.name ?? t('meals.unknownFood'),
            amount: item.amount,
            calories: item.food.calories * multiplier,
            protein: item.food.protein * multiplier,
            carbs: item.food.carbs * multiplier,
            fat: item.food.fat * multiplier,
          };
        }
      );
      setIngredients(newIngredients);
    }
  }, [visible, initialFoods, meal, setIngredients, t]);

  useEffect(() => {
    if (visible && isQuickTrack && logDate) {
      setSelectedDate(localCalendarDayDate(logDate));
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

  // Total meal weight in grams (sum of raw ingredients)
  const totalMealGrams = useMemo(
    () => ingredients.reduce((sum, ing) => sum + ing.amount, 0),
    [ingredients]
  );

  // Reference grams for scaling: prepared weight if set, otherwise raw ingredient sum
  const referenceMealGrams = preparedWeightGrams ?? totalMealGrams;

  useEffect(() => {
    if (isQuickTrack) {
      setMealAmountGrams(referenceMealGrams);
    }
  }, [isQuickTrack, referenceMealGrams]);

  const handleRemoveIngredient = (foodId: string) => {
    setIngredientToRemoveId(foodId);
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
      await MealService.deleteMeal(meal.id);
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Error deleting meal:', error);
      captureException(error, { data: { context: 'CreateMealModal.handleDeleteMeal' } });
      showSnackbar('error', t('common.deleteFailed'));
    } finally {
      setIsDeletingMeal(false);
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
        await MealService.createMealFromFoods(
          mealName.trim(),
          ingredients.map((ing) => ({ foodId: ing.foodId, amount: ing.amount })),
          mealDescription.trim()
        );
      }
      const scale = referenceMealGrams > 0 ? mealAmountGrams / referenceMealGrams : 1;
      for (const ing of ingredients) {
        await NutritionService.logFood(
          ing.foodId,
          selectedDate,
          selectedMealType,
          ing.amount * scale,
          undefined
        );
      }
      onTracked?.();
      onClose();
      showSnackbar('success', t('food.quickTrackMeal.successMessage'));
    } catch (error) {
      console.error('Error tracking quick meal:', error);
      captureException(error, { data: { context: 'CreateMealModal.handleTrack' } });
      showSnackbar('error', t('food.quickTrackMeal.errorMessage'));
    } finally {
      setIsSaving(false);
    }
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
          preparedWeightGrams: preparedWeightGrams || null,
        });
        for (const mealFoodId of removedMealFoodIdsRef.current) {
          await MealService.removeFoodFromMeal(mealFoodId);
        }
        const newIngredients = ingredients.filter((ing) => !ing.mealFoodId);
        for (const ing of newIngredients) {
          await MealService.addFoodToMeal(meal.id, ing.foodId, ing.amount);
        }
      } else {
        // Create mode
        await MealService.createMealFromFoods(
          mealName.trim(),
          ingredients.map((ing) => ({
            foodId: ing.foodId,
            amount: ing.amount,
          })),
          mealDescription.trim(),
          false,
          preparedWeightGrams || undefined
        );
      }

      // Callback to refresh meals list
      onSave?.();

      // Close modal
      onClose();
    } catch (error) {
      console.error('Error saving meal:', error);
      captureException(error, { data: { context: 'CreateMealModal.handleSave' } });
      showSnackbar('error', t('food.createMeal.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const removeIngredient = (foodId: string) => {
    setIngredients((prev) => {
      const toRemove = prev.find((item) => item.foodId === foodId);
      if (toRemove?.mealFoodId) {
        removedMealFoodIdsRef.current.push(toRemove.mealFoodId);
      }
      return prev.filter((item) => item.foodId !== foodId);
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

  const mealTypeOptions = useMemo(() => getMealTypeOptions(theme, t), [theme, t]);

  const handleAddFoods = (selectedFoods: { food: Food; amount: number }[]) => {
    const newIngredients: Ingredient[] = selectedFoods.map((item) => {
      // Calculate nutrients based on amount (per 100g base)
      const multiplier = item.amount / 100;
      return {
        foodId: item.food.id,
        name: item.food.name ?? t('meals.unknownFood'),
        amount: item.amount,
        calories: item.food.calories * multiplier,
        protein: item.food.protein * multiplier,
        carbs: item.food.carbs * multiplier,
        fat: item.food.fat * multiplier,
      };
    });

    setIngredients((prev) => [...prev, ...newIngredients]);
    setIsAddFoodVisible(false);
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={
        isQuickTrack
          ? t('food.quickTrackMeal.title')
          : meal
            ? t('food.meals.manageMealData.editMeal')
            : t('food.createMeal.title')
      }
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
            icon={isSaving ? undefined : isQuickTrack ? Check : CheckCircle2}
            onPress={isQuickTrack ? handleTrack : handleSave}
            disabled={
              isSaving || (isQuickTrack && (ingredients.length === 0 || mealAmountGrams < 1))
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

        {/* Total Nutrition Card */}
        <MealMacrosSummary
          calories={
            isQuickTrack && referenceMealGrams > 0
              ? totalMacros.calories * (mealAmountGrams / referenceMealGrams)
              : totalMacros.calories
          }
          macros={
            isQuickTrack && referenceMealGrams > 0
              ? {
                  protein: totalMacros.protein * (mealAmountGrams / referenceMealGrams),
                  carbs: totalMacros.carbs * (mealAmountGrams / referenceMealGrams),
                  fat: totalMacros.fat * (mealAmountGrams / referenceMealGrams),
                }
              : totalMacros
          }
          intuitiveMode={intuitiveEatingMode}
        />

        {/* Ingredients Section */}
        <View className="mb-6">
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
                  key={item.foodId}
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
                        {formatInteger(Math.round(item.amount))}g
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
                  <Pressable onPress={() => handleRemoveIngredient(item.foodId)} className="p-2">
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
