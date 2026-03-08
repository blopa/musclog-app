import { format } from 'date-fns';
import {
  Apple,
  Calendar,
  Check,
  Coffee,
  Moon,
  MoreHorizontal,
  Plus,
  Trash2,
  Utensils,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import type { MealType } from '../../database/models';
import Food from '../../database/models/Food';
import { MealService, NutritionService } from '../../database/services';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme';
import { OptionsSelector, type SelectorOption } from '../OptionsSelector';
import { useSnackbar } from '../SnackbarContext';
import { Button } from '../theme/Button';
import { AddFoodItemToMealModal } from './AddFoodItemToMealModal';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';

export type QuickTrackIngredient = {
  foodId: string;
  name: string;
  amount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type QuickTrackMealModalProps = {
  visible: boolean;
  onClose: () => void;
  logDate: Date;
  onTracked?: () => void;
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

const MealMacrosSummary = ({
  calories,
  macros,
}: {
  calories: number;
  macros: { protein: number; carbs: number; fat: number };
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const proteinProgress = Math.min((macros.protein / 100) * 100, 100);
  const carbsProgress = Math.min((macros.carbs / 150) * 100, 100);
  const fatProgress = Math.min((macros.fat / 80) * 100, 100);

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.cardElevated,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.padding.lg,
        marginBottom: theme.spacing.margin.lg,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border.light,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: theme.spacing.margin.md,
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
            {t('food.quickTrackMeal.ingredients')}
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
  );
};

const getMealTypeOptions = (
  theme: Theme,
  t: (key: string) => string
): SelectorOption<MealType>[] => [
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
    label: t('food.meals.trackOther'),
    description: t('food.meals.trackOther'),
    icon: MoreHorizontal,
    iconBgColor: theme.colors.status.gray10,
    iconColor: theme.colors.text.secondary,
  },
];

export function QuickTrackMealModal({
  visible,
  onClose,
  logDate,
  onTracked,
}: QuickTrackMealModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [ingredients, setIngredients] = useState<QuickTrackIngredient[]>([]);
  const [selectedDate, setSelectedDate] = useState(logDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [saveToMyMeals, setSaveToMyMeals] = useState(false);
  const [mealName, setMealName] = useState('');
  const [isAddFoodVisible, setIsAddFoodVisible] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [mealNameFocused, setMealNameFocused] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedDate(logDate);
    }
  }, [visible, logDate]);

  const totalMacros = useMemo(
    () =>
      ingredients.reduce(
        (acc, ing) => ({
          calories: acc.calories + ing.calories,
          protein: acc.protein + ing.protein,
          carbs: acc.carbs + ing.carbs,
          fat: acc.fat + ing.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [ingredients]
  );

  const mealTypeOptions = useMemo(() => getMealTypeOptions(theme, t), [theme, t]);

  const handleAddFoods = useCallback((selectedFoods: { food: Food; amount: number }[]) => {
    const newIngredients: QuickTrackIngredient[] = selectedFoods.map((item) => {
      const multiplier = item.amount / 100;
      return {
        foodId: item.food.id,
        name: item.food.name ?? 'Unknown',
        amount: item.amount,
        calories: (item.food.calories ?? 0) * multiplier,
        protein: (item.food.protein ?? 0) * multiplier,
        carbs: (item.food.carbs ?? 0) * multiplier,
        fat: (item.food.fat ?? 0) * multiplier,
      };
    });
    setIngredients((prev) => [...prev, ...newIngredients]);
    setIsAddFoodVisible(false);
  }, []);

  const removeIngredient = useCallback((foodId: string) => {
    setIngredients((prev) => prev.filter((item) => item.foodId !== foodId));
  }, []);

  const handleTrack = useCallback(async () => {
    if (ingredients.length === 0) {
      showSnackbar('error', t('food.quickTrackMeal.addOneIngredient'), { action: t('common.ok') });
      return;
    }
    if (saveToMyMeals && !mealName.trim()) {
      showSnackbar('error', t('food.quickTrackMeal.mealNameRequired'), { action: t('common.ok') });
      return;
    }

    setIsTracking(true);
    await new Promise((resolve) => setTimeout(resolve, 1));

    try {
      if (saveToMyMeals) {
        await MealService.createMealFromFoods(
          mealName.trim(),
          ingredients.map((ing) => ({ foodId: ing.foodId, amount: ing.amount })),
          ''
        );
      }
      for (const ing of ingredients) {
        await NutritionService.logFood(
          ing.foodId,
          selectedDate,
          selectedMealType,
          ing.amount,
          undefined
        );
      }
      onTracked?.();
      onClose();
      showSnackbar('success', t('food.quickTrackMeal.successMessage'), {
        action: t('snackbar.ok'),
      });
    } catch (err) {
      console.error('Error tracking quick meal:', err);
      showSnackbar('error', t('food.quickTrackMeal.errorMessage'), { action: t('snackbar.ok') });
    } finally {
      setIsTracking(false);
    }
  }, [
    ingredients,
    saveToMyMeals,
    mealName,
    selectedDate,
    selectedMealType,
    onTracked,
    onClose,
    showSnackbar,
    t,
  ]);

  const formatDate = useCallback((date: Date) => format(date, 'yyyy-MM-dd'), []);

  const footer = (
    <Button
      label={t('food.quickTrackMeal.trackMeal')}
      variant="gradientCta"
      size="md"
      width="full"
      icon={isTracking ? undefined : Check}
      onPress={handleTrack}
      loading={isTracking}
      disabled={isTracking || ingredients.length === 0}
    />
  );

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('food.quickTrackMeal.title')}
        footer={footer}
        scrollable
      >
        <View className="mb-6 mt-6 space-y-6 px-4">
          {/* Macros summary */}
          <MealMacrosSummary calories={totalMacros.calories} macros={totalMacros} />

          {/* Ingredients list */}
          <View>
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
                {ingredients.length === 0
                  ? t('food.quickTrackMeal.ingredients')
                  : t('food.quickTrackMeal.ingredientsCount', { count: ingredients.length })}
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
                    {t('food.quickTrackMeal.addOneIngredient')}
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
                  {t('food.quickTrackMeal.addIngredient')}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Date */}
          <View>
            <Text
              className="mb-3 ml-1 text-sm font-semibold"
              style={{ color: theme.colors.text.primary }}
            >
              {t('food.quickTrackMeal.date')}
            </Text>
            <Pressable
              className="flex-row items-center justify-between rounded-xl p-4"
              style={{
                backgroundColor: theme.colors.background.card,
                borderColor: theme.colors.border.light,
                borderWidth: theme.borderWidth.thin,
              }}
              onPress={() => setShowDatePicker(true)}
            >
              <View className="flex-row items-center gap-3">
                <Calendar size={theme.iconSize.md} color={theme.colors.text.secondary} />
                <Text
                  className="text-base font-medium"
                  style={{ color: theme.colors.text.primary }}
                >
                  {formatDate(selectedDate)}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Meal type */}
          <OptionsSelector<MealType>
            title={t('food.quickTrackMeal.mealType')}
            options={mealTypeOptions}
            selectedId={selectedMealType}
            onSelect={setSelectedMealType}
          />

          {/* Save to My Meals toggle */}
          <View
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
              thumbColor={saveToMyMeals ? theme.colors.accent.primary : theme.colors.text.tertiary}
            />
          </View>

          {/* Meal name (when save is on) */}
          {saveToMyMeals ? (
            <View className="space-y-2">
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
                  borderWidth: mealNameFocused ? theme.borderWidth.medium : theme.borderWidth.thin,
                  borderColor: mealNameFocused
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
                  onFocus={() => setMealNameFocused(true)}
                  onBlur={() => setMealNameFocused(false)}
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    color: theme.colors.text.primary,
                    borderWidth: 0,
                    padding: 0,
                  }}
                />
              </View>
            </View>
          ) : null}
        </View>
      </FullScreenModal>

      {isAddFoodVisible ? (
        <AddFoodItemToMealModal
          visible={isAddFoodVisible}
          onClose={() => setIsAddFoodVisible(false)}
          onAddFoods={handleAddFoods}
        />
      ) : null}

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
      />
    </>
  );
}
