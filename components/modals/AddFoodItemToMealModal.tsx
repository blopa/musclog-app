import { Check, PlusCircle, ScanLine } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button } from '@/components/theme/Button';
import { StepperInput } from '@/components/theme/StepperInput';
import { TextInput } from '@/components/theme/TextInput';
import { useSmartCamera } from '@/context/SmartCameraContext';
import Food from '@/database/models/Food';
import { useFoods } from '@/hooks/useFoods';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { blurFilter } from '@/utils/blurFilter';

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
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { intuitiveEatingMode } = useSettings();
  const isPerServing = food.resolvedNutritionBasis === 'per_serving';
  const calories = formatRoundedDecimal(
    isPerServing ? food.calories * amount : (food.calories * amount) / 100,
    2
  );

  const calorieLabel = intuitiveEatingMode
    ? `0 ${t('common.kcal')}`
    : `${isSelected ? calories : formatRoundedDecimal(food.calories, 2)} ${t('common.kcal')}`;

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
                style={[
                  {
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: isSelected ? theme.colors.accent.primary : theme.colors.text.secondary,
                  },
                  intuitiveEatingMode ? blurFilter(4) : undefined,
                ]}
              >
                {calorieLabel}
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
            {food.brand ? `${food.brand} • ` : ''}
            {isPerServing ? t('food.foodDetails.perServing') : t('food.portions.100g')}
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
              style={[
                {
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.primary,
                  fontWeight: theme.typography.fontWeight.medium,
                },
                intuitiveEatingMode ? blurFilter(4) : undefined,
              ]}
            >
              {t('foodSearch.macroProtein', {
                value: intuitiveEatingMode
                  ? '0'
                  : formatRoundedDecimal(
                      isPerServing ? food.protein * amount : (food.protein * amount) / 100,
                      2
                    ),
              })}
            </Text>
            <Text
              style={[
                {
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.primary,
                  fontWeight: theme.typography.fontWeight.medium,
                },
                intuitiveEatingMode ? blurFilter(4) : undefined,
              ]}
            >
              {t('foodSearch.macroCarbs', {
                value: intuitiveEatingMode
                  ? '0'
                  : formatRoundedDecimal(
                      isPerServing ? food.carbs * amount : (food.carbs * amount) / 100,
                      2
                    ),
              })}
            </Text>
            <Text
              style={[
                {
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.primary,
                  fontWeight: theme.typography.fontWeight.medium,
                },
                intuitiveEatingMode ? blurFilter(4) : undefined,
              ]}
            >
              {t('foodSearch.macroFat', {
                value: intuitiveEatingMode
                  ? '0'
                  : formatRoundedDecimal(
                      isPerServing ? food.fat * amount : (food.fat * amount) / 100,
                      2
                    ),
              })}
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
            maxFractionDigits={isPerServing ? 2 : 0}
            onChangeValue={onAmountChange}
            onIncrement={() => onAmountChange(amount + (isPerServing ? 0.5 : 1))}
            onDecrement={() =>
              onAmountChange(Math.max(isPerServing ? 0.5 : 0, amount - (isPerServing ? 0.5 : 1)))
            }
            unit={isPerServing ? t('food.foodDetails.serving') : 'g'}
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
  const { openCamera } = useSmartCamera();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { selected: boolean; amount: number }>
  >({});

  const [showScannedFoodDetails, setShowScannedFoodDetails] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setShowScannedFoodDetails(false);
        setScannedBarcode(null);
      };
      reset();
    }
  }, [visible]);

  const { foods, isLoading, isLoadingMore, hasMore, loadMore } = useFoods({
    mode: searchQuery.trim() ? 'search' : 'list',
    searchTerm: searchQuery.trim(),
    initialLimit: 10,
    visible, // avoid loading while modal is hidden
  });

  const selectedCount = Object.values(selectedItems).filter((i) => i.selected).length;

  const toggleItem = (food: Food) => {
    setSelectedItems((prev) => {
      const current = prev[food.id] || {
        selected: false,
        amount: food.resolvedNutritionBasis === 'per_serving' ? 1 : 100,
      };

      return {
        ...prev,
        [food.id]: { ...current, selected: !current.selected },
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

  const openBarcodeScanner = () => {
    openCamera({
      mode: 'barcode-scan',
      hideCameraModePicker: true,
      showBarcodeTextSearch: true,
      onBarcodeScanned: (data) => {
        setScannedBarcode(data);
        setShowScannedFoodDetails(true);
      },
    });
  };

  let resultsContent;
  if (isLoading) {
    resultsContent = (
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
    );
  } else if (foods.length === 0) {
    resultsContent = (
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
    );
  } else {
    resultsContent = (
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.gap.md }}
        bottomOffset={16}
      >
        {foods.map((food) => (
          <FoodResultCard
            key={food.id}
            food={food}
            isSelected={!!selectedItems[food.id]?.selected}
            amount={
              selectedItems[food.id]?.amount ??
              (food.resolvedNutritionBasis === 'per_serving' ? 1 : 100)
            }
            onToggle={() => toggleItem(food)}
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
      </KeyboardAwareScrollView>
    );
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      scrollable={false}
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
        {resultsContent}
      </View>
      <ScannedFoodDetailsModal
        visible={showScannedFoodDetails}
        onClose={() => setShowScannedFoodDetails(false)}
        barcode={scannedBarcode || ''}
        onAddFood={handleAddScannedFood}
      />
    </FullScreenModal>
  );
}
