import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Animated } from 'react-native';
import { Search, X, Check, PlusCircle } from 'lucide-react-native';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';
import { Button } from './theme/Button';

type FoodResult = {
  id: string;
  name: string;
  description: string;
  caloriesPer100g: number;
  protein: number;
  carbs: number;
  fat: number;
};

const SEARCH_RESULTS: FoodResult[] = [
  {
    id: '1',
    name: 'Chicken Breast',
    description: 'Raw, boneless, skinless • 100g',
    caloriesPer100g: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  },
  {
    id: '2',
    name: 'Chicken Thigh',
    description: 'Raw, skinless • 100g',
    caloriesPer100g: 209,
    protein: 26,
    carbs: 0,
    fat: 10.9,
  },
  {
    id: '3',
    name: 'Roasted Chicken',
    description: 'Meat only, cooked • 100g',
    caloriesPer100g: 237,
    protein: 27,
    carbs: 0,
    fat: 13.5,
  },
  {
    id: '4',
    name: 'Chicken Wings',
    description: 'Raw, with skin • 100g',
    caloriesPer100g: 203,
    protein: 18,
    carbs: 0,
    fat: 14,
  },
  {
    id: '5',
    name: 'Chicken Soup',
    description: 'Homemade • 100g',
    caloriesPer100g: 36,
    protein: 2.5,
    carbs: 3.5,
    fat: 1.2,
  },
];

type FoodResultCardProps = {
  food: FoodResult;
  isSelected: boolean;
  amount: string;
  onToggle: () => void;
  onAmountChange: (value: string) => void;
};

function FoodResultCard({ food, isSelected, amount, onToggle, onAmountChange }: FoodResultCardProps) {
  const calories = Math.round((food.caloriesPer100g * (parseInt(amount) || 0)) / 100);

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.card,
        borderRadius: theme.borderRadius.md,
        padding: 12,
        borderWidth: theme.borderWidth.thin,
        borderColor: isSelected ? theme.colors.accent.primary : theme.colors.border.light,
        shadowColor: isSelected ? theme.colors.accent.primary : 'transparent',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: isSelected ? 3 : 0,
      }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ paddingTop: 2 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
              borderWidth: isSelected ? 0 : 2,
              borderColor: theme.colors.border.light,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {isSelected && <Check size={16} color={theme.colors.text.black} strokeWidth={3} />}
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: isSelected ? '700' : '500',
                color: theme.colors.text.primary,
                flex: 1,
              }}>
              {food.name}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: isSelected ? theme.colors.accent.primary : theme.colors.text.secondary,
                backgroundColor: isSelected ? theme.colors.accent.primary10 : theme.colors.background.white5,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
              }}>
              {isSelected ? `${calories} kcal` : `${food.caloriesPer100g} kcal`}
            </Text>
          </View>

          <Text style={{ fontSize: 12, color: theme.colors.text.tertiary, marginTop: 2 }}>
            {food.description}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <MacroBadge label="P" value={`${food.protein}g`} />
            <MacroBadge label="C" value={`${food.carbs}g`} />
            <MacroBadge label="F" value={`${food.fat}g`} />
          </View>
        </View>
      </Pressable>

      {isSelected && (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.colors.border.light,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Text style={{ fontSize: 12, fontWeight: '500', color: theme.colors.text.secondary }}>
            Amount
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: 8,
              paddingHorizontal: 8,
              height: 36,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
            }}>
            <TextInput
              value={amount}
              onChangeText={onAmountChange}
              keyboardType="numeric"
              style={{
                width: 40,
                textAlign: 'center',
                color: theme.colors.text.primary,
                fontWeight: '700',
                fontSize: 14,
              }}
            />
            <Text style={{ fontSize: 12, color: theme.colors.text.tertiary, marginLeft: 2 }}>g</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function MacroBadge({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.background.white5,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
      }}>
      <Text style={{ fontSize: 10, color: theme.colors.text.tertiary, fontWeight: '500' }}>
        {label}: {value}
      </Text>
    </View>
  );
}

type AddFoodItemToMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onAddFoods?: (foods: { food: FoodResult; amount: number }[]) => void;
};

export function AddFoodItemToMealModal({ visible, onClose, onAddFoods }: AddFoodItemToMealModalProps) {
  const [searchQuery, setSearchQuery] = useState('Chicken');
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; amount: string }>>({
    '1': { selected: true, amount: '200' },
    '3': { selected: true, amount: '150' },
  });

  const selectedCount = Object.values(selectedItems).filter((i) => i.selected).length;

  const totalCalories = useMemo(() => {
    return SEARCH_RESULTS.reduce((acc, food) => {
      const selection = selectedItems[food.id];
      if (selection?.selected) {
        return acc + Math.round((food.caloriesPer100g * (parseInt(selection.amount) || 0)) / 100);
      }
      return acc;
    }, 0);
  }, [selectedItems]);

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const current = prev[id] || { selected: false, amount: '100' };
      return {
        ...prev,
        [id]: { ...current, selected: !current.selected },
      };
    });
  };

  const updateAmount = (id: string, amount: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { selected: true, amount: '100' }), amount },
    }));
  };

  const handleAdd = () => {
    const foodsToAdd = SEARCH_RESULTS.filter((f) => selectedItems[f.id]?.selected).map((f) => ({
      food: f,
      amount: parseInt(selectedItems[f.id].amount) || 0,
    }));
    onAddFoods?.(foodsToAdd);
    onClose();
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title="Add Food"
      headerRight={
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.accent.primary }}>
          {selectedCount} Selected
        </Text>
      }
      footer={
        <View className="px-4 pb-8 pt-2">
          <Button
            label={`Add ${selectedCount} Selected Foods`}
            variant="gradientCta"
            size="lg"
            width="full"
            icon={PlusCircle}
            onPress={handleAdd}
            style={{ position: 'relative' }}
          />
          <View
            style={{
              position: 'absolute',
              right: 28,
              top: '50%',
              marginTop: -28, // Offset because of footer padding and button centering
              backgroundColor: 'rgba(0,0,0,0.1)',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 4,
              pointerEvents: 'none',
              zIndex: 10,
            }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text.white }}>
              {totalCalories} kcal
            </Text>
          </View>
        </View>
      }>
      <View className="flex-1 px-4 py-2">
        {/* Search Bar */}
        <View className="mb-6">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.background.card,
              borderRadius: 14,
              paddingHorizontal: 12,
              height: 48,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
            }}>
            <Search size={20} color={theme.colors.text.tertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search food (e.g. Chicken)..."
              placeholderTextColor={theme.colors.text.tertiary}
              style={{
                flex: 1,
                marginLeft: 10,
                color: theme.colors.text.primary,
                fontSize: 14,
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={18} color={theme.colors.text.tertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Search Results Header */}
        <View className="mb-4 flex-row items-end justify-between px-1">
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
            Search Results
          </Text>
          <Text style={{ fontSize: 12, color: theme.colors.text.tertiary }}>
            Found {SEARCH_RESULTS.length} items
          </Text>
        </View>

        {/* Results List */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {SEARCH_RESULTS.map((food) => (
            <FoodResultCard
              key={food.id}
              food={food}
              isSelected={!!selectedItems[food.id]?.selected}
              amount={selectedItems[food.id]?.amount || '100'}
              onToggle={() => toggleItem(food.id)}
              onAmountChange={(val) => updateAmount(food.id, val)}
            />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </FullScreenModal>
  );
}

