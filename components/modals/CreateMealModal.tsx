import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { MoreVertical, Trash2, Plus, CheckCircle2, Egg, Info, Apple } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { Button } from '../theme/Button';
import { AddFoodItemToMealModal } from './AddFoodItemToMealModal';

type Ingredient = {
  id: string;
  name: string;
  amount: string;
  calories: number;
  icon: React.ElementType;
};

const INITIAL_INGREDIENTS: Ingredient[] = [
  {
    id: '1',
    name: 'Large Whole Eggs',
    amount: '2 large',
    calories: 143,
    icon: Egg,
  },
  {
    id: '2',
    name: 'Sourdough Toast',
    amount: '2 slices',
    calories: 180,
    icon: Info, // Using Info as a fallback for bakery
  },
  {
    id: '3',
    name: 'Avocado',
    amount: '1/2 medium',
    calories: 114,
    icon: Apple, // Using Apple as a fallback for nutrition/fruit
  },
];

type CreateMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (mealData: any) => void;
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
}) => (
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

// Local component for Meal Macros Summary
const MealMacrosSummary = ({
  macros,
}: {
  macros: { protein: number; carbs: number; fat: number };
}) => {
  const { t } = useTranslation();
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
              854 {t('common.kcal')}
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
            value="62g"
            progress={70}
            color={theme.colors.accent.primary}
          />
          <MacroCard
            label={t('food.macros.carbs')}
            value="95g"
            progress={45}
            color={theme.colors.status.indigo}
          />
          <MacroCard
            label={t('food.macros.fat')}
            value="24g"
            progress={30}
            color={theme.colors.status.amber}
          />
        </View>
      </View>
    </View>
  );
};

export function CreateMealModal({ visible, onClose, onSave }: CreateMealModalProps) {
  const { t } = useTranslation();
  const [mealName, setMealName] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>(INITIAL_INGREDIENTS);
  const [isAddFoodVisible, setIsAddFoodVisible] = useState(false);

  const handleSave = () => {
    onSave?.({
      name: mealName,
      ingredients,
      totalCalories: 854,
      macros: { protein: 62, carbs: 95, fat: 24 },
    });
    onClose();
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('food.createMeal.title')}
      headerRight={
        <Pressable className="p-2">
          <MoreVertical size={theme.iconSize.md} color={theme.colors.text.secondary} />
        </Pressable>
      }
      footer={
        <View className="px-4 pb-8 pt-2">
          <Button
            label={t('food.createMeal.saveMeal')}
            variant="gradientCta"
            size="md"
            width="full"
            icon={CheckCircle2}
            onPress={handleSave}
          />
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
        <MealMacrosSummary macros={{ protein: 62, carbs: 95, fat: 24 }} />

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
            {ingredients.map((item) => {
              const Icon = item.icon;
              return (
                <View
                  key={item.id}
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
                    <Icon size={theme.iconSize.lg} color={theme.colors.text.secondary} />
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
                        {item.amount}
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
                        {item.calories} {t('common.kcal')}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => removeIngredient(item.id)} className="p-2">
                    <Trash2 size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
                  </Pressable>
                </View>
              );
            })}

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

      <AddFoodItemToMealModal
        visible={isAddFoodVisible}
        onClose={() => setIsAddFoodVisible(false)}
        onAddFoods={(foods) => {
          console.log('Foods added to meal:', foods);
          // Here you would typically add these to the ingredients state
          // but for now we just close the modal as per the prompt
          setIsAddFoodVisible(false);
        }}
      />
    </FullScreenModal>
  );
}
