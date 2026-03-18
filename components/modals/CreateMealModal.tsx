import { format } from 'date-fns';
import type { TFunction } from 'i18next';
import {
  Apple,
  Calendar,
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
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from 'react-native';

import { useSnackbar } from '../../context/SnackbarContext';
import type { MealType } from '../../database/models';
import Food from '../../database/models/Food';
import Meal from '../../database/models/Meal';
import { MealService, NutritionService } from '../../database/services';
import { type Ingredient, useEditMealIngredients } from '../../hooks/useEditMealIngredients';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme';
import { OptionsSelector, type SelectorOption } from '../OptionsSelector';
import { ServingSizeSelector } from '../ServingSizeSelector';
import { Button } from '../theme/Button';
import { MenuButton } from '../theme/MenuButton';
import { AddFoodItemToMealModal } from './AddFoodItemToMealModal';
import { ConfirmationModal } from './ConfirmationModal';
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
};

const MacroCard = ({
  label,
  value,
  progress,
  color,
}: {
  label: string;
  value: string;
  progress: number;
  color: string;
}) => {
  const theme = useTheme();
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
        style={{
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text.primary,
        }}
      >
        {value}
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
            width: `${progress}%`,
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
}: {
  calories: number;
  macros: { protein: number; carbs: number; fat: number };
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

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
              style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.secondary,
              }}
            >
              {Math.round(calories)} {t('common.kcal')}
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
            label={t('food.macros.protein')}
            value={`${Math.round(macros.protein)}g`}
            progress={proteinProgress}
            color={theme.colors.accent.primary}
          />
          <MacroCard
            label={t('food.macros.carbs')}
            value={`${Math.round(macros.carbs)}g`}
            progress={carbsProgress}
            color={theme.colors.status.indigo}
          />
          <MacroCard
            label={t('food.macros.fat')}
            value={`${Math.round(macros.fat)}g`}
            progress={fatProgress}
            color={theme.colors.status.amber}
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
}: CreateMealModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [mealName, setMealName] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isAddFoodVisible, setIsAddFoodVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmationModalVisible, setIsConfirmationModalVisible] = useState(false);
  const [ingredientToRemoveId, setIngredientToRemoveId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(logDate ?? new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [saveToMyMeals, setSaveToMyMeals] = useState(false);
  const [mealAmountGrams, setMealAmountGrams] = useState(0);

  const isQuickTrack = mode === 'quickTrack';
  const { ingredients, setIngredients, removedMealFoodIdsRef } = useEditMealIngredients(
    isQuickTrack ? undefined : meal
  );

  useEffect(() => {
    setMealName(meal?.name ?? '');
  }, [meal]);

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
      setSelectedDate(logDate);
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

  // Total meal weight in grams (quickTrack: for serving selector and scaling)
  const totalMealGrams = useMemo(
    () => ingredients.reduce((sum, ing) => sum + ing.amount, 0),
    [ingredients]
  );

  useEffect(() => {
    if (isQuickTrack) {
      setMealAmountGrams(totalMealGrams);
    }
  }, [isQuickTrack, totalMealGrams]);

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

  const handleTrack = async () => {
    if (ingredients.length === 0) {
      showSnackbar('error', t('food.quickTrackMeal.addOneIngredient'), {
        action: t('common.ok'),
      });
      return;
    }
    if (saveToMyMeals && !mealName.trim()) {
      showSnackbar('error', t('food.quickTrackMeal.mealNameRequired'), {
        action: t('common.ok'),
      });
      return;
    }

    setIsSaving(true);
    try {
      if (saveToMyMeals) {
        await MealService.createMealFromFoods(
          mealName.trim(),
          ingredients.map((ing) => ({ foodId: ing.foodId, amount: ing.amount })),
          ''
        );
      }
      const scale = totalMealGrams > 0 ? mealAmountGrams / totalMealGrams : 1;
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
      showSnackbar('success', t('food.quickTrackMeal.successMessage'), {
        action: t('snackbar.ok'),
      });
    } catch (error) {
      console.error('Error tracking quick meal:', error);
      showSnackbar('error', t('food.quickTrackMeal.errorMessage'), {
        action: t('snackbar.ok'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    // Validate meal name
    if (!mealName.trim()) {
      showSnackbar('error', t('food.createMeal.mealNameRequired'), {
        action: t('common.ok'),
      });
      return;
    }

    // Validate ingredients
    if (ingredients.length === 0) {
      showSnackbar('error', t('food.createMeal.ingredientsRequired'), {
        action: t('common.ok'),
      });
      return;
    }

    setIsSaving(true);
    try {
      if (meal) {
        // Edit mode: update name, remove deleted foods, add new foods
        await MealService.updateMeal(meal.id, { name: mealName.trim() });
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
          '' // No description for now
        );
      }

      // Callback to refresh meals list
      onSave?.();

      // Close modal
      onClose();
    } catch (error) {
      console.error('Error saving meal:', error);
      showSnackbar('error', t('food.createMeal.saveFailed'), {
        action: t('common.ok'),
      });
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
      headerRight={isQuickTrack ? undefined : <MenuButton size="md" className="p-2" />}
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
          <View className="mb-6 space-y-2">
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: theme.typography.letterSpacing.extraWide,
                marginLeft: theme.spacing.margin.xs,
              }}
            >
              {t('food.createMeal.mealName')}
            </Text>
            <View
              style={{
                height: theme.components.button.height.md,
                backgroundColor: theme.colors.background.card,
                borderRadius: theme.borderRadius.md,
                borderWidth: isFocused ? theme.borderWidth.medium : theme.borderWidth.thin,
                borderColor: isFocused ? theme.colors.accent.primary : theme.colors.border.light,
                paddingHorizontal: theme.spacing.padding.base,
                justifyContent: 'center',
                shadowColor: isFocused ? theme.colors.accent.primary : 'transparent',
                shadowOffset: theme.shadowOffset.zero,
                shadowOpacity: theme.colors.opacity.subtle,
                shadowRadius: theme.shadows.radius8.shadowRadius,
                elevation: isFocused ? theme.elevation.sm : theme.elevation.none,
              }}
            >
              <TextInput
                value={mealName}
                onChangeText={setMealName}
                placeholder={t('food.createMeal.mealNamePlaceholder')}
                placeholderTextColor={theme.colors.text.tertiary}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={{
                  fontSize: theme.typography.fontSize.base,
                  color: theme.colors.text.primary,
                  borderWidth: theme.borderWidth.none,
                }}
              />
            </View>
          </View>
        ) : null}

        {/* Total Nutrition Card */}
        <MealMacrosSummary
          calories={
            isQuickTrack && totalMealGrams > 0
              ? totalMacros.calories * (mealAmountGrams / totalMealGrams)
              : totalMacros.calories
          }
          macros={
            isQuickTrack && totalMealGrams > 0
              ? {
                  protein: totalMacros.protein * (mealAmountGrams / totalMealGrams),
                  carbs: totalMacros.carbs * (mealAmountGrams / totalMealGrams),
                  fat: totalMacros.fat * (mealAmountGrams / totalMealGrams),
                }
              : totalMacros
          }
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
                        {Math.round(item.amount)}g
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
                        style={{
                          fontSize: theme.typography.fontSize.xs,
                          color: theme.colors.text.secondary,
                        }}
                      >
                        {Math.round(item.calories)} {t('common.kcal')}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => handleRemoveIngredient(item.foodId)} className="p-2">
                    <Trash2 size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
                  </Pressable>
                </View>
              ))
            )}

            <Pressable
              onPress={() => setIsAddFoodVisible(true)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing.gap.sm,
                paddingVertical: theme.spacing.padding.base,
                marginTop: theme.spacing.padding.sm,
                borderRadius: theme.borderRadius.md,
                borderWidth: theme.borderWidth.thin,
                borderStyle: 'dashed',
                borderColor: theme.colors.border.dashed,
                backgroundColor: pressed ? theme.colors.accent.primary5 : 'transparent',
              })}
            >
              <View
                style={{
                  width: theme.iconSize.xl,
                  height: theme.iconSize.xl,
                  borderRadius: theme.borderRadius.md,
                  backgroundColor: theme.colors.background.secondaryDark,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus
                  size={theme.iconSize.sm}
                  color={theme.colors.text.secondary}
                  strokeWidth={theme.strokeWidth.thick}
                />
              </View>
              <Text
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.text.secondary,
                }}
              >
                {isQuickTrack
                  ? t('food.quickTrackMeal.addIngredient')
                  : t('food.createMeal.addFoodItem')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Quick Track: Serving size (grams), date, meal type, save toggle, optional meal name */}
        {isQuickTrack ? (
          <>
            <View style={{ marginBottom: theme.spacing.margin.xl }}>
              <ServingSizeSelector
                value={mealAmountGrams}
                onChange={(v) => setMealAmountGrams(Math.round(v))}
                quickSizes={
                  totalMealGrams > 0
                    ? [
                        { label: '½×', value: Math.round(totalMealGrams * 0.5) },
                        { label: '1×', value: totalMealGrams },
                        { label: '1½×', value: Math.round(totalMealGrams * 1.5) },
                        { label: '2×', value: totalMealGrams * 2 },
                      ]
                    : []
                }
              />
            </View>
            <View className="mb-6">
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.text.secondary,
                  textTransform: 'uppercase',
                  letterSpacing: theme.typography.letterSpacing.extraWide,
                  marginLeft: theme.spacing.margin.xs,
                  marginBottom: theme.spacing.padding.sm,
                }}
              >
                {t('food.quickTrackMeal.date')}
              </Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.gap.sm,
                  padding: theme.spacing.padding.base,
                  backgroundColor: theme.colors.background.card,
                  borderRadius: theme.borderRadius.lg,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.border.light,
                }}
              >
                <Calendar size={theme.iconSize.md} color={theme.colors.text.secondary} />
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text.primary,
                  }}
                >
                  {format(selectedDate, 'yyyy-MM-dd')}
                </Text>
              </Pressable>
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
              <View className="mb-6 space-y-2">
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.colors.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: theme.typography.letterSpacing.extraWide,
                    marginLeft: theme.spacing.margin.xs,
                  }}
                >
                  {t('food.quickTrackMeal.mealName')}
                </Text>
                <View
                  style={{
                    height: theme.components.button.height.md,
                    backgroundColor: theme.colors.background.card,
                    borderRadius: theme.borderRadius.md,
                    borderWidth: isFocused ? theme.borderWidth.medium : theme.borderWidth.thin,
                    borderColor: isFocused
                      ? theme.colors.accent.primary
                      : theme.colors.border.light,
                    paddingHorizontal: theme.spacing.padding.base,
                    justifyContent: 'center',
                  }}
                >
                  <TextInput
                    value={mealName}
                    onChangeText={setMealName}
                    placeholder={t('food.quickTrackMeal.mealNamePlaceholder')}
                    placeholderTextColor={theme.colors.text.tertiary}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    style={{
                      fontSize: theme.typography.fontSize.base,
                      color: theme.colors.text.primary,
                      borderWidth: theme.borderWidth.none,
                    }}
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

      {isQuickTrack ? (
        <DatePickerModal
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          selectedDate={selectedDate}
          onDateSelect={(date) => {
            setSelectedDate(date);
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
    </FullScreenModal>
  );
}
