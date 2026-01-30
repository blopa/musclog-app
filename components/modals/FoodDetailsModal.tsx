import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Calendar, Edit, PlusCircle } from 'lucide-react-native';
import { format, isSameDay } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { FilterTabs } from '../FilterTabs';
import { DatePickerModal } from './DatePickerModal';
import { Button } from '../theme/Button';
import { FoodInfoCard } from '../cards/FoodInfoCard';
import { ServingSizeSelector } from '../ServingSizeSelector';
import { useFoodProductDetails } from '../../hooks/useFoodProductDetails';
import { isSuccessFoodDetailProductState } from '../../types/guards/openFoodFacts';
import { FoodService, NutritionService } from '../../database/services';
import { FoodNotFoundModal } from './FoodNotFoundModal';

type FoodDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  barcode?: string | null;
  onAddFood?: (data: { servingSize: number; meal: string; date: Date }) => void;
};

export function FoodDetailsModal({ visible, onClose, barcode, onAddFood }: FoodDetailsModalProps) {
  const { t } = useTranslation();
  const [servingSize, setServingSize] = useState(100);
  const [selectedMeal, setSelectedMeal] = useState('lunch');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isFoodNotFoundModalVisible, setIsFoodNotFoundModalVisible] = useState(false);
  const [isFoodDetailsModalVisible, setIsFoodDetailsModalVisible] = useState(false);

  // Fetch detailed product data if barcode is provided
  const { data: productDetails } = useFoodProductDetails(barcode || null);

  useEffect(() => {
    if (productDetails) {
      if (productDetails?.status !== 'success') {
        setIsFoodNotFoundModalVisible(true);
      } else {
        setIsFoodDetailsModalVisible(true);
      }
    }
  }, [productDetails]);

  // Extract nutritional data from barcode lookup
  const getNutritionalData = useCallback(() => {
    if (isSuccessFoodDetailProductState(productDetails)) {
      const nutrients = productDetails.product.nutriments || {};
      return {
        calories: (nutrients['energy-kcal'] as number) || 0,
        protein: (nutrients['proteins'] as number) || 0,
        carbs: (nutrients['carbohydrates'] as number) || 0,
        fat: (nutrients['fat'] as number) || 0,
        fiber:
          (nutrients['carbohydrates-total'] as number) - (nutrients['carbohydrates'] as number) ||
          0,
        sugars: (nutrients['sugars'] as number) || 0,
        saturatedFat: (nutrients['saturated-fat'] as number) || 0,
        sodium: (nutrients['sodium'] as number) || 0,
        salt: (nutrients['salt'] as number) || 0,
      };
    }

    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugars: 0,
      saturatedFat: 0,
      sodium: 0,
      salt: 0,
    };
  }, [productDetails]);

  const nutritionalData = getNutritionalData();

  // Get product name from barcode lookup
  const getProductName = useCallback(() => {
    if (isSuccessFoodDetailProductState(productDetails)) {
      return productDetails.product.product_name || 'Unknown Food';
    }
    return 'Unknown Food';
  }, [productDetails]);

  // Get product category/brand from barcode lookup
  const getProductCategory = useCallback(() => {
    if (isSuccessFoodDetailProductState(productDetails)) {
      const brand = productDetails.product.brands;
      const categories = productDetails.product.categories;

      if (brand && categories) {
        return `${brand} • ${categories}`;
      }
      if (brand) {
        return brand;
      }
      if (categories) {
        return categories;
      }
    }
    return '';
  }, [productDetails]);

  // Get default serving size from barcode lookup
  const getDefaultServingSize = useCallback(() => {
    if (isSuccessFoodDetailProductState(productDetails)) {
      const servingSize = productDetails.product.serving_size;
      if (servingSize) {
        // Extract numeric value from serving size (e.g., "1 loaf (30 g)" -> 30)
        const match = servingSize.match(/\((\d+)\s*g\)/);
        if (match) {
          return parseInt(match[1]);
        }
        const numericMatch = servingSize.match(/(\d+)/);
        if (numericMatch) {
          return parseInt(numericMatch[1]);
        }
      }
    }
    return 100; // Default to 100g
  }, [productDetails]);

  // Update serving size when product details load
  useEffect(() => {
    if (productDetails) {
      const defaultSize = getDefaultServingSize();
      setServingSize(defaultSize);
    }
  }, [productDetails, getDefaultServingSize]);

  // Calculate nutritional values based on serving size
  const getScaledNutrition = useCallback(() => {
    const scaleFactor = servingSize / 100; // API data is per 100g
    return {
      name: getProductName(),
      category: getProductCategory(),
      calories: Math.round(nutritionalData.calories * scaleFactor),
      protein: Math.round(nutritionalData.protein * scaleFactor * 10) / 10,
      carbs: Math.round(nutritionalData.carbs * scaleFactor * 10) / 10,
      fat: Math.round(nutritionalData.fat * scaleFactor * 10) / 10,
    };
  }, [
    getProductCategory,
    getProductName,
    nutritionalData.calories,
    nutritionalData.carbs,
    nutritionalData.fat,
    nutritionalData.protein,
    servingSize,
  ]);

  const scaledFood = getScaledNutrition();

  const mealTabs = [
    { id: 'breakfast', label: t('food.meals.breakfast') },
    { id: 'lunch', label: t('food.meals.lunch') },
    { id: 'dinner', label: t('food.meals.dinner') },
    { id: 'snack', label: t('food.meals.snacks') },
    { id: 'other', label: t('food.meals.trackOther') },
  ];

  const handleAddFood = useCallback(async () => {
    try {
      if (!isSuccessFoodDetailProductState(productDetails)) {
        throw new Error('Product details not loaded');
      }

      // Save barcode product to local database
      const newFood = await FoodService.createFromV3Product(productDetails.product, {
        calories: nutritionalData.calories,
        protein: nutritionalData.protein,
        carbs: nutritionalData.carbs,
        fat: nutritionalData.fat,
        fiber: nutritionalData.fiber,
        sugars: nutritionalData.sugars,
        saturatedFat: nutritionalData.saturatedFat,
        sodium: nutritionalData.sodium,
        salt: nutritionalData.salt,
      });

      // Create nutrition log
      await NutritionService.logFood(
        newFood.id,
        selectedDate,
        selectedMeal as any, // Type assertion since our meal types match
        servingSize
      );

      // Call the original callback if provided
      onAddFood?.({
        servingSize,
        meal: selectedMeal,
        date: selectedDate,
      });

      onClose();

      // Show success message
      Alert.alert('Success', 'Food tracked successfully!', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Error tracking food:', error);
      Alert.alert('Error', 'Failed to track food. Please try again.', [{ text: 'OK' }]);
    }
  }, [
    productDetails,
    nutritionalData.calories,
    nutritionalData.carbs,
    nutritionalData.fat,
    nutritionalData.fiber,
    nutritionalData.protein,
    nutritionalData.salt,
    nutritionalData.saturatedFat,
    nutritionalData.sodium,
    nutritionalData.sugars,
    onAddFood,
    onClose,
    selectedDate,
    selectedMeal,
    servingSize,
  ]);

  // Handlers for FoodNotFoundModal actions
  const handleTryAiScan = useCallback(() => {
    setIsFoodNotFoundModalVisible(false);
    // Trigger AI scan logic
  }, []);

  const handleSearchAgain = useCallback(() => {
    setIsFoodNotFoundModalVisible(false);
    // Trigger search again logic
  }, []);

  const handleCreateCustom = useCallback(() => {
    setIsFoodNotFoundModalVisible(false);
    // Trigger create custom food logic
  }, []);

  const handleFoodNotFoundClose = useCallback(() => {
    setIsFoodNotFoundModalVisible(false);
  }, []);

  if (!visible) {
    // TODO: return an full screen overlay with a loading spinner
    return null;
  }

  if (isFoodNotFoundModalVisible) {
    return (
      <FoodNotFoundModal
        visible={isFoodNotFoundModalVisible}
        onClose={handleFoodNotFoundClose}
        onTryAiScan={handleTryAiScan}
        onSearchAgain={handleSearchAgain}
        onCreateCustom={handleCreateCustom}
      />
    );
  }

  return (
    <>
      <FullScreenModal
        visible={isFoodDetailsModalVisible}
        onClose={onClose}
        title={t('food.foodDetails.title')}
        scrollable={true}
        footer={
          <View className="bg-transparent px-4 pb-6 pt-3">
            <Button
              label={t('food.foodDetails.addFood')}
              icon={PlusCircle}
              variant="gradientCta"
              size="sm"
              width="full"
              onPress={handleAddFood}
            />
          </View>
        }
      >
        <View className="flex-1 px-4 pb-6">
          {/* Food Info Card */}
          <View className="mt-6">
            <FoodInfoCard food={scaledFood} />

            {/* Additional Nutritional Info */}
            {nutritionalData.fiber > 0 ||
            nutritionalData.sugars > 0 ||
            nutritionalData.saturatedFat > 0 ||
            nutritionalData.salt > 0 ? (
              <View className="mt-4 rounded-2xl border border-border-light bg-bg-overlay p-4">
                <Text className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">
                  Additional Nutrition
                </Text>
                <View className="gap-2">
                  {nutritionalData.fiber > 0 ? (
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-text-secondary">Fiber</Text>
                      <Text className="text-sm font-medium text-text-primary">
                        {Math.round(nutritionalData.fiber * (servingSize / 100) * 10) / 10}g
                      </Text>
                    </View>
                  ) : null}
                  {nutritionalData.sugars > 0 ? (
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-text-secondary">Sugars</Text>
                      <Text className="text-sm font-medium text-text-primary">
                        {Math.round(nutritionalData.sugars * (servingSize / 100) * 10) / 10}g
                      </Text>
                    </View>
                  ) : null}
                  {nutritionalData.saturatedFat > 0 ? (
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-text-secondary">Saturated Fat</Text>
                      <Text className="text-sm font-medium text-text-primary">
                        {Math.round(nutritionalData.saturatedFat * (servingSize / 100) * 10) / 10}g
                      </Text>
                    </View>
                  ) : null}
                  {nutritionalData.salt > 0 ? (
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-text-secondary">Salt</Text>
                      <Text className="text-sm font-medium text-text-primary">
                        {Math.round(nutritionalData.salt * (servingSize / 100) * 1000) / 1000}g
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {/* Form Sections */}
          <View className="gap-6">
            {/* Serving Size */}
            <ServingSizeSelector value={servingSize} onChange={setServingSize} />

            {/* Meal Selection */}
            <View>
              <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">
                {t('food.foodDetails.meal')}
              </Text>
              <FilterTabs
                tabs={mealTabs}
                activeTab={selectedMeal}
                onTabChange={setSelectedMeal}
                showContainer={false}
                scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
              />
            </View>

            {/* Date Selection */}
            <View>
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
                {t('food.foodDetails.date')}
              </Text>
              <Pressable
                className="flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-cardDark p-4"
                onPress={() => setIsDatePickerVisible(true)}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: theme.colors.status.indigo20,
                    }}
                  >
                    <Calendar size={theme.iconSize.md} color={theme.colors.accent.primary} />
                  </View>
                  <View>
                    <Text className="font-medium text-text-primary">
                      {isSameDay(selectedDate, new Date())
                        ? t('food.foodDetails.today')
                        : format(selectedDate, 'EEEE')}
                    </Text>
                    <Text className="text-xs text-text-secondary">
                      {format(selectedDate, 'MMMM d, yyyy')}
                    </Text>
                  </View>
                </View>
                <Edit size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* footer is handled by FullScreenModal */}

        {/* Date Picker Modal */}
        <DatePickerModal
          visible={isDatePickerVisible}
          onClose={() => setIsDatePickerVisible(false)}
          selectedDate={selectedDate}
          onDateSelect={(date) => {
            setSelectedDate(date);
            setIsDatePickerVisible(false);
          }}
        />
      </FullScreenModal>
    </>
  );
}
