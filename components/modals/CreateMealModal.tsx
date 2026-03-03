import { Apple, CheckCircle2, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import Food from '../../database/models/Food';
import Meal from '../../database/models/Meal';
import { MealService } from '../../database/services';
import { useTheme } from '../../hooks/useTheme';
import { useSnackbar } from '../SnackbarContext';
import { Button } from '../theme/Button';
import { MenuButton } from '../theme/MenuButton';
import { AddFoodItemToMealModal } from './AddFoodItemToMealModal';
import { FullScreenModal } from './FullScreenModal';

type Ingredient = {
  mealFoodId?: string; // present when loaded from an existing meal (edit mode)
  foodId: string;
  name: string;
  amount: number; // in grams
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type CreateMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: () => void; // Callback to refresh meals list
  meal?: Meal; // When provided, the modal operates in edit mode
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

export function CreateMealModal({ visible, onClose, onSave, meal }: CreateMealModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [mealName, setMealName] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isAddFoodVisible, setIsAddFoodVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const removedMealFoodIdsRef = useRef<string[]>([]);

  // TODO: can this be moved to a hook?
  useEffect(() => {
    removedMealFoodIdsRef.current = [];
    if (!meal) {
      setMealName('');
      setIngredients([]);
      return;
    }
    setMealName(meal.name ?? '');
    MealService.getMealWithFoods(meal.id).then(async (result) => {
      if (!result) {
        return;
      }

      const loaded = await Promise.all(
        result.foods.map(async (mf) => {
          const food = await mf.food;
          const nutrients = await mf.getNutrients();
          return {
            mealFoodId: mf.id,
            foodId: mf.foodId,
            name: food?.name ?? t('food.unknownFood'),
            amount: mf.amount,
            calories: nutrients.calories,
            protein: nutrients.protein,
            carbs: nutrients.carbs,
            fat: nutrients.fat,
          };
        })
      );
      setIngredients(loaded);
    });
  }, [meal, t]);

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

  const handleAddFoods = (selectedFoods: { food: Food; amount: number }[]) => {
    const newIngredients: Ingredient[] = selectedFoods.map((item) => {
      // Calculate nutrients based on amount (per 100g base)
      const multiplier = item.amount / 100;
      return {
        foodId: item.food.id,
        name: item.food.name ?? 'Unknown',
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
      title={meal ? t('food.meals.manageMealData.editMeal') : t('food.createMeal.title')}
      headerRight={<MenuButton size="md" className="p-2" />}
      footer={
        <View className="px-4 pb-8 pt-2">
          <Button
            label={
            // TODO: move this to a helper function to avoid nested ternary
              isSaving
                ? t('common.saving')
                : meal
                  ? t('common.save')
                  : t('food.createMeal.saveMeal')
            }
            variant="gradientCta"
            size="md"
            width="full"
            icon={isSaving ? undefined : CheckCircle2}
            onPress={handleSave}
            disabled={isSaving}
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
        {/* Meal Name Input Section */}
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

        {/* Total Nutrition Card */}
        <MealMacrosSummary calories={totalMacros.calories} macros={totalMacros} />

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
            <Pressable>
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.accent.primary,
                  textTransform: 'uppercase',
                  letterSpacing: theme.typography.letterSpacing.wider,
                }}
              >
                {t('food.createMeal.editList')}
              </Text>
            </Pressable>
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
                  <Pressable onPress={() => removeIngredient(item.foodId)} className="p-2">
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
                {t('food.createMeal.addFoodItem')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {isAddFoodVisible ? (
        <AddFoodItemToMealModal
          visible={isAddFoodVisible}
          onClose={() => setIsAddFoodVisible(false)}
          onAddFoods={handleAddFoods}
        />
      ) : null}
    </FullScreenModal>
  );
}
