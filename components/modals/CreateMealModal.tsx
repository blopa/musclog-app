import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { MoreVertical, Trash2, Plus, CheckCircle2, Egg, Info, Apple } from 'lucide-react-native';
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
      backgroundColor: 'rgba(10, 31, 26, 0.6)',
      borderRadius: theme.borderRadius.md,
      padding: 10,
      borderWidth: theme.borderWidth.thin,
      borderColor: theme.colors.border.light,
      alignItems: 'center',
    }}>
    <Text
      style={{
        fontSize: 10,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
      }}>
      {label}
    </Text>
    <Text
      style={{
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
      }}>
      {value}
    </Text>
    <View
      style={{
        width: '100%',
        height: 4,
        backgroundColor: theme.colors.background.white10,
        borderRadius: 2,
        marginTop: 8,
        overflow: 'hidden',
      }}>
      <View
        style={{
          height: '100%',
          width: `${progress}%`,
          backgroundColor: color,
          borderRadius: 2,
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
}) => (
  <View
    style={{
      backgroundColor: theme.colors.background.cardElevated,
      borderRadius: theme.borderRadius.lg,
      padding: 20,
      marginBottom: 24,
      borderWidth: theme.borderWidth.thin,
      borderColor: theme.colors.border.light,
      position: 'relative',
      overflow: 'hidden',
    }}>
    {/* Background Glows */}
    <View
      style={{
        position: 'absolute',
        top: -40,
        right: -40,
        width: 160,
        height: 160,
        backgroundColor: theme.colors.accent.primary20,
        borderRadius: 80,
        opacity: 0.5,
      }}
    />
    <View
      style={{
        position: 'absolute',
        bottom: -40,
        left: -40,
        width: 160,
        height: 160,
        backgroundColor: `${theme.colors.status.indigo}20`,
        borderRadius: 80,
        opacity: 0.5,
      }}
    />

    <View style={{ position: 'relative', zIndex: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}>
        <View>
          <Text
            style={{
              fontSize: theme.typography.fontSize.base,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.primary,
            }}>
            Total Nutrition
          </Text>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.text.secondary,
            }}>
            854 kcal
          </Text>
        </View>
        <View
          style={{
            backgroundColor: theme.colors.background.cardDark,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: theme.borderRadius.full,
            borderWidth: 1,
            borderColor: theme.colors.border.light,
          }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
            Estimated
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <MacroCard label="Protein" value="62g" progress={70} color={theme.colors.accent.primary} />
        <MacroCard label="Carbs" value="95g" progress={45} color={theme.colors.status.indigo} />
        <MacroCard label="Fat" value="24g" progress={30} color="#fbbf24" />
      </View>
    </View>
  </View>
);

export function CreateMealModal({ visible, onClose, onSave }: CreateMealModalProps) {
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
      title="Create New Meal"
      headerRight={
        <Pressable className="p-2">
          <MoreVertical size={theme.iconSize.md} color={theme.colors.text.secondary} />
        </Pressable>
      }
      footer={
        <View className="px-4 pb-8 pt-2">
          <Button
            label="Save Meal"
            variant="gradientCta"
            size="md"
            width="full"
            icon={CheckCircle2}
            onPress={handleSave}
          />
        </View>
      }>
      <View className="flex-1 px-4 py-6">
        {/* Meal Name Input Section */}
        <View className="mb-6 space-y-2">
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginLeft: 4,
            }}>
            Meal Name
          </Text>
          <View
            style={{
              height: 56,
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.md,
              borderWidth: isFocused ? 2 : 1,
              borderColor: isFocused ? theme.colors.accent.primary : theme.colors.border.light,
              paddingHorizontal: 16,
              justifyContent: 'center',
              shadowColor: isFocused ? theme.colors.accent.primary : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: isFocused ? 2 : 0,
            }}>
            <TextInput
              value={mealName}
              onChangeText={setMealName}
              placeholder="e.g. Post-Workout Smoothie"
              placeholderTextColor={theme.colors.text.tertiary}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.primary,
                borderWidth: 0,
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
                letterSpacing: 1.2,
              }}>
              Ingredients ({ingredients.length})
            </Text>
            <Pressable>
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.accent.primary,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}>
                Edit List
              </Text>
            </Pressable>
          </View>

          <View style={{ gap: 12 }}>
            {ingredients.map((item) => {
              const Icon = item.icon;
              return (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.colors.background.card,
                    padding: 12,
                    borderRadius: theme.borderRadius.md,
                    borderWidth: theme.borderWidth.thin,
                    borderColor: theme.colors.border.light,
                  }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      backgroundColor: theme.colors.background.cardDark,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: theme.colors.border.light,
                      marginRight: 12,
                    }}>
                    <Icon size={20} color={theme.colors.text.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: theme.typography.fontSize.sm,
                        fontWeight: theme.typography.fontWeight.bold,
                        color: theme.colors.text.primary,
                      }}>
                      {item.name}
                    </Text>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>
                        {item.amount}
                      </Text>
                      <View
                        style={{
                          width: 2,
                          height: 2,
                          borderRadius: 1,
                          backgroundColor: theme.colors.text.tertiary,
                        }}
                      />
                      <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>
                        {item.calories} kcal
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => removeIngredient(item.id)} className="p-2">
                    <Trash2 size={20} color={theme.colors.text.tertiary} />
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
                gap: 8,
                paddingVertical: 16,
                marginTop: 8,
                borderRadius: theme.borderRadius.md,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: theme.colors.border.dashed,
                backgroundColor: pressed ? theme.colors.accent.primary5 : 'transparent',
              })}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: theme.colors.background.cardDark,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Plus size={16} color={theme.colors.text.secondary} strokeWidth={3} />
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.text.secondary,
                }}>
                Add Food Item
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
