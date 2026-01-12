import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput as RNTextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Search, X, Check, PlusCircle } from 'lucide-react-native';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { Button } from '../theme/Button';
import { TextInput } from '../theme/TextInput';

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

function FoodResultCard({
  food,
  isSelected,
  amount,
  onToggle,
  onAmountChange,
}: FoodResultCardProps) {
  const calories = Math.round((food.caloriesPer100g * (parseInt(amount) || 0)) / 100);
  const amountInputRef = useRef<RNTextInput>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);

  const handleAmountFocus = () => {
    // Select all text on focus
    if (amountInputRef.current && amount) {
      const length = amount.length;
      setSelection({ start: 0, end: length });

      // For iOS, use selectTextOnFocus prop, but we'll handle it with selection
      // For Android, we need to use setNativeProps
      if (Platform.OS === 'android') {
        setTimeout(() => {
          amountInputRef.current?.setNativeProps({
            selection: { start: 0, end: length },
          });
        }, 0);
      }
    }
  };

  const handleAmountBlur = () => {
    // Clear selection on blur
    setSelection(undefined);
  };

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.cardElevated,
        borderRadius: theme.borderRadius.md,
        padding: 12,
        borderWidth: isSelected ? 1 : theme.borderWidth.thin,
        borderColor: isSelected ? theme.colors.accent.primary : theme.colors.border.light,
        shadowColor: isSelected ? theme.colors.accent.primary : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isSelected ? 0.4 : 0,
        shadowRadius: isSelected ? 8 : 0,
        elevation: isSelected ? 3 : 0,
      }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ paddingTop: 4 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
              borderWidth: isSelected ? 0 : 2,
              borderColor: theme.colors.text.tertiary,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: isSelected ? theme.colors.accent.primary : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
            }}>
            {isSelected && <Check size={16} color={theme.colors.text.black} strokeWidth={3} />}
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
            }}>
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: isSelected
                  ? theme.typography.fontWeight.bold
                  : theme.typography.fontWeight.medium,
                color: theme.colors.text.primary,
                flex: 1,
              }}>
              {food.name}
            </Text>
            <View
              style={{
                backgroundColor: isSelected
                  ? theme.colors.accent.primary10
                  : theme.colors.background.white5,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
              }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: isSelected ? theme.colors.accent.primary : theme.colors.text.secondary,
                }}>
                {isSelected ? `${calories} kcal` : `${food.caloriesPer100g} kcal`}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 12, color: theme.colors.text.primary, marginTop: 4 }}>
            {food.description}
          </Text>

          <View
            style={{ flexDirection: 'row', gap: 8, marginTop: 8, opacity: isSelected ? 1 : 0.7 }}>
            <Text
              style={{
                fontSize: 10,
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}>
              P: {food.protein}g
            </Text>
            <Text
              style={{
                fontSize: 10,
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}>
              C: {food.carbs}g
            </Text>
            <Text
              style={{
                fontSize: 10,
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}>
              F: {food.fat}g
            </Text>
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
          <Text
            style={{
              fontSize: 12,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.text.secondary,
            }}>
            Amount
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.background.cardDark,
              borderRadius: 8,
              paddingHorizontal: 8,
              height: 36,
              borderWidth: 1,
              borderColor: 'transparent',
            }}>
            {/*OBS: this one can stay unthemed for now*/}
            <RNTextInput
              ref={amountInputRef}
              value={amount}
              onChangeText={onAmountChange}
              onFocus={handleAmountFocus}
              onBlur={handleAmountBlur}
              selection={selection}
              selectTextOnFocus={Platform.OS === 'ios'}
              keyboardType="numeric"
              style={{
                width: 48,
                textAlign: 'center',
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.bold,
                fontSize: 14,
              }}
            />
            <Text
              style={{
                fontSize: 12,
                color: theme.colors.text.primary,
                paddingRight: 4,
                fontWeight: theme.typography.fontWeight.medium,
              }}>
              g
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

type AddFoodItemToMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onAddFoods?: (foods: { food: FoodResult; amount: number }[]) => void;
};

export function AddFoodItemToMealModal({
  visible,
  onClose,
  onAddFoods,
}: AddFoodItemToMealModalProps) {
  const [searchQuery, setSearchQuery] = useState('Chicken');
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { selected: boolean; amount: string }>
  >({
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
            size="md"
            width="full"
            icon={PlusCircle}
            onPress={handleAdd}
            style={{ position: 'relative' }}
          />
        </View>
      }>
      <View className="flex-1 px-4 py-2">
        {/* Search Bar */}
        <View className="mb-6">
          <TextInput
            label="Search Food"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search food (e.g. Chicken)..."
            icon={<Search size={20} color={theme.colors.text.tertiary} />}
          />
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
