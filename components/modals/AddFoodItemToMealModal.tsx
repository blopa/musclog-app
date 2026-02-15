import { Check, PlusCircle, Search } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';

import Food from '../../database/models/Food';
import { useFoods } from '../../hooks/useFoods';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../theme/Button';
import { TextInput } from '../theme/TextInput';
import { FullScreenModal } from './FullScreenModal';

type FoodResultCardProps = {
  food: Food;
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
  const theme = useTheme();
  const { t } = useTranslation();
  const calories = Math.round((food.calories * (parseInt(amount) || 0)) / 100);
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

  const handleAmountChange = (value: string) => {
    // Clear selection when user starts typing so they can type normally
    setSelection(undefined);
    onAmountChange(value);
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
        padding: theme.spacing.padding.md,
        borderWidth: theme.borderWidth.thin,
        borderColor: isSelected ? theme.colors.accent.primary : theme.colors.border.light,
        shadowColor: isSelected ? theme.colors.accent.primary : 'transparent',
        shadowOffset: theme.shadowOffset.zero,
        shadowOpacity: isSelected ? theme.shadowOpacity.mediumHeavy : 0,
        shadowRadius: isSelected ? theme.shadowRadius.md : 0,
        elevation: isSelected ? theme.elevation.md : 0,
      }}
    >
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', gap: theme.spacing.gap.md }}>
        <View style={{ paddingTop: theme.spacing.padding.xs }}>
          <View
            style={{
              width: theme.size.xl,
              height: theme.size.xl,
              borderRadius: theme.borderRadius.md,
              backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
              borderWidth: isSelected ? 0 : theme.borderWidth.medium,
              borderColor: theme.colors.text.tertiary,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: isSelected ? theme.colors.accent.primary : 'transparent',
              shadowOffset: theme.shadowOffset.zero,
              shadowOpacity: theme.colors.opacity.subtle,
              shadowRadius: theme.shadows.radius4.shadowRadius,
            }}
          >
            {isSelected ? (
              <Check
                size={theme.iconSize.sm}
                color={theme.colors.text.black}
                strokeWidth={theme.strokeWidth.thick}
              />
            ) : null}
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: theme.spacing.gap.sm,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: isSelected
                  ? theme.typography.fontWeight.bold
                  : theme.typography.fontWeight.medium,
                color: theme.colors.text.primary,
                flex: 1,
              }}
            >
              {food.name}
            </Text>
            <View
              style={{
                backgroundColor: isSelected
                  ? theme.colors.accent.primary10
                  : theme.colors.background.white5,
                paddingHorizontal: theme.spacing.padding.sm,
                paddingVertical: theme.spacing.padding.xs,
                borderRadius: theme.borderRadius.md,
              }}
            >
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: isSelected ? theme.colors.accent.primary : theme.colors.text.secondary,
                }}
              >
                {isSelected
                  ? `${calories} ${t('common.kcal')}`
                  : `${Math.round(food.calories)} ${t('common.kcal')}`}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.primary,
              marginTop: theme.size.xs,
            }}
          >
            {food.brand ? `${food.brand} • ` : ''}100g serving
          </Text>

          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.gap.sm,
              marginTop: theme.spacing.gap.sm,
              opacity: isSelected ? 1 : theme.colors.opacity.strong,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              P: {food.protein}g
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              C: {food.carbs}g
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              F: {food.fat}g
            </Text>
          </View>
        </View>
      </Pressable>

      {isSelected ? (
        <View
          style={{
            marginTop: theme.spacing.padding.md,
            paddingTop: theme.spacing.padding.md,
            borderTopWidth: theme.borderWidth.thin,
            borderStyle: 'dashed',
            borderColor: theme.colors.border.light,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.text.secondary,
            }}
          >
            {t('food.addFoodItemToMeal.amount')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.background.secondaryDark,
              borderRadius: theme.borderRadius.sm,
              paddingHorizontal: theme.spacing.padding.sm,
              height: theme.components.button.height.sm,
              borderWidth: theme.borderWidth.thin,
              borderColor: 'transparent',
            }}
          >
            {/*OBS: this one can stay unthemed for now*/}
            <RNTextInput
              ref={amountInputRef}
              value={amount}
              onChangeText={handleAmountChange}
              onFocus={handleAmountFocus}
              onBlur={handleAmountBlur}
              selection={selection}
              keyboardType="numeric"
              style={{
                width: 80,
                textAlign: 'center',
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.bold,
                fontSize: theme.typography.fontSize.sm,
              }}
            />
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.primary,
                paddingRight: theme.spacing.padding.xs,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              g
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

type AddFoodItemToMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onAddFoods?: (foods: { food: Food; amount: number }[]) => void;
};

export function AddFoodItemToMealModal({
  visible,
  onClose,
  onAddFoods,
}: AddFoodItemToMealModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { selected: boolean; amount: string }>
  >({});

  // Fetch foods from database
  const { foods, isLoading } = useFoods({
    mode: searchQuery.trim() ? 'search' : 'list',
    searchTerm: searchQuery.trim(),
    getAll: true,
  }) as { foods: Food[]; isLoading: boolean };

  const selectedCount = Object.values(selectedItems).filter((i) => i.selected).length;

  const totalCalories = useMemo(() => {
    return foods.reduce((acc, food) => {
      const selection = selectedItems[food.id];
      if (selection?.selected) {
        return acc + Math.round((food.calories * (parseInt(selection.amount) || 0)) / 100);
      }

      return acc;
    }, 0);
  }, [selectedItems, foods]);

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
    const foodsToAdd = foods.filter((f) => selectedItems[f.id]?.selected).map((f) => ({
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
      title={t('food.addFoodItemToMeal.title')}
      headerRight={
        <Text
          style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.accent.primary,
          }}
        >
          {t('food.addFoodItemToMeal.selectedCount', { count: selectedCount })}
        </Text>
      }
      footer={
        <Button
          label={t('food.addFoodItemToMeal.addSelectedFoods', { count: selectedCount })}
          variant="gradientCta"
          size="md"
          width="full"
          icon={PlusCircle}
          onPress={handleAdd}
          style={{ position: 'relative' }}
        />
      }
    >
      <View className="flex-1 px-4 py-2">
        {/* Search Bar */}
        <View className="mb-6">
          <TextInput
            label={t('food.addFoodItemToMeal.searchFood')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('food.addFoodItemToMeal.searchPlaceholder')}
            icon={<Search size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
          />
        </View>

        {/* Search Results Header */}
        <View className="mb-4 flex-row items-end justify-between px-1">
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.wider,
            }}
          >
            {t('food.addFoodItemToMeal.searchResults')}
          </Text>
          <Text
            style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.tertiary }}
          >
            {t('food.addFoodItemToMeal.foundItems', { count: foods.length })}
          </Text>
        </View>

        {/* Results List */}
        {isLoading ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: theme.spacing.padding['4xl'],
            }}
          >
            <ActivityIndicator size="large" color={theme.colors.accent.primary} />
            <Text
              style={{
                marginTop: theme.spacing.padding.md,
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.tertiary,
              }}
            >
              {t('common.loading')}
            </Text>
          </View>
        ) : foods.length === 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: theme.spacing.padding['4xl'],
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.tertiary,
                textAlign: 'center',
              }}
            >
              {searchQuery.trim()
                ? t('food.addFoodItemToMeal.noResults')
                : t('food.addFoodItemToMeal.noFoods')}
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.gap.md }}
          >
            {foods.map((food) => (
              <FoodResultCard
                key={food.id}
                food={food}
                isSelected={!!selectedItems[food.id]?.selected}
                amount={selectedItems[food.id]?.amount || '100'}
                onToggle={() => toggleItem(food.id)}
                onAmountChange={(val) => updateAmount(food.id, val)}
              />
            ))}
            <View style={{ height: theme.size['100'] }} />
          </ScrollView>
        )}
      </View>
    </FullScreenModal>
  );
}
