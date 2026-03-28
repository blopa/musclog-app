import { Check, PlusCircle, ScanLine } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import Food from '../../database/models/Food';
import { useFoods } from '../../hooks/useFoods';
import { useTheme } from '../../hooks/useTheme';
import { roundToDecimalPlaces } from '../../utils/roundDecimal';
import { Button } from '../theme/Button';
import { StepperInput } from '../theme/StepperInput';
import { TextInput } from '../theme/TextInput';
import { BarcodeCameraModal } from './BarcodeCameraModal';
import { FullScreenModal } from './FullScreenModal';
import { ScannedFoodDetailsModal } from './ScannedFoodDetailsModal';

type FoodResultCardProps = {
  food: Food;
  isSelected: boolean;
  amount: number;
  onToggle: () => void;
  onAmountChange: (value: number) => void;
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
  const calories = roundToDecimalPlaces((food.calories * amount) / 100);

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
                  : `${roundToDecimalPlaces(food.calories)} ${t('common.kcal')}`}
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
              {t('foodSearch.macroProtein', {
                value: roundToDecimalPlaces((food.protein * amount) / 100),
              })}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              {t('foodSearch.macroCarbs', {
                value: roundToDecimalPlaces((food.carbs * amount) / 100),
              })}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.primary,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              {t('foodSearch.macroFat', { value: roundToDecimalPlaces((food.fat * amount) / 100) })}
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
          }}
        >
          <StepperInput
            label={t('food.addFoodItemToMeal.amount')}
            value={amount}
            onChangeValue={onAmountChange}
            onIncrement={() => onAmountChange(amount + 1)}
            onDecrement={() => onAmountChange(Math.max(0, amount - 1))}
            unit="g"
          />
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
    Record<string, { selected: boolean; amount: number }>
  >({});
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showScannedFoodDetails, setShowScannedFoodDetails] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  const { foods, isLoading, isLoadingMore, hasMore, loadMore, totalCount } = useFoods({
    mode: searchQuery.trim() ? 'search' : 'list',
    searchTerm: searchQuery.trim(),
    initialLimit: 10,
    visible, // avoid loading while modal is hidden
  });

  const selectedCount = Object.values(selectedItems).filter((i) => i.selected).length;

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const current = prev[id] || { selected: false, amount: 100 };
      return {
        ...prev,
        [id]: { ...current, selected: !current.selected },
      };
    });
  };

  const updateAmount = (id: string, amount: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { selected: true, amount: 100 }), amount },
    }));
  };

  const handleAdd = () => {
    const foodsToAdd = foods
      .filter((f) => selectedItems[f.id]?.selected)
      .map((f) => ({
        food: f,
        amount: selectedItems[f.id].amount || 0,
      }));
    onAddFoods?.(foodsToAdd);
    onClose();
  };

  const handleAddScannedFood = (foodData: { food: any; amount: number }) => {
    onAddFoods?.([foodData]);
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    setScannedBarcode(scannedBarcode);
    setShowBarcodeScanner(false);
    setShowScannedFoodDetails(true);
  };

  const openBarcodeScanner = () => {
    setShowBarcodeScanner(true);
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
            icon={
              <Pressable onPress={openBarcodeScanner}>
                <ScanLine size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </Pressable>
            }
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
                amount={selectedItems[food.id]?.amount || 100}
                onToggle={() => toggleItem(food.id)}
                onAmountChange={(val) => updateAmount(food.id, val)}
              />
            ))}
            {hasMore ? (
              <View className="py-3">
                <Button
                  label={
                    isLoadingMore
                      ? t('food.addFoodItemToMeal.loadingMore')
                      : t('food.addFoodItemToMeal.loadMore')
                  }
                  onPress={loadMore}
                  size="sm"
                  variant="outline"
                  disabled={isLoadingMore}
                  loading={isLoadingMore}
                  width="full"
                />
              </View>
            ) : null}
            <View style={{ height: theme.size['100'] }} />
          </ScrollView>
        )}
      </View>
      <BarcodeCameraModal
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <ScannedFoodDetailsModal
        visible={showScannedFoodDetails}
        onClose={() => setShowScannedFoodDetails(false)}
        barcode={scannedBarcode || ''}
        onAddFood={handleAddScannedFood}
      />
    </FullScreenModal>
  );
}
