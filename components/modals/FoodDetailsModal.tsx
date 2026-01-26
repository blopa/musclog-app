import React, { useState, useEffect } from 'react';
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
import { useProductDetails } from '../../hooks/useSearchFood';
import { isSuccessFoodProductState } from '../../types/guards/openFoodFacts';
import { FoodService, NutritionService } from '../../database/services';

type FoodDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  food?: {
    name: string;
    category: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  // Additional props for API data
  barcode?: string;
  serving_size?: string;
  nutriments?: any;
  _raw?: any;
  source?: 'local' | 'api'; // Determine if food is from local DB or API
  onAddFood?: (data: { servingSize: number; meal: string; date: Date }) => void;
};

export function FoodDetailsModal({
  visible,
  onClose,
  food = {
    // TODO: remove hardcodded data
    name: 'Grilled Chicken Breast',
    category: 'Lean Meat • High Protein',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  },
  barcode,
  serving_size,
  nutriments,
  _raw,
  source = 'local', // Default to local
  onAddFood,
}: FoodDetailsModalProps) {
  const { t } = useTranslation();
  const [servingSize, setServingSize] = useState(100);
  const [selectedMeal, setSelectedMeal] = useState('lunch');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  // Fetch detailed product data if barcode is provided
  const { data: productDetails } = useProductDetails(barcode || null);

  // Extract nutritional data from API response
  const getNutritionalData = () => {
    if (
      isSuccessFoodProductState(productDetails) &&
      productDetails.product.nutrition?.aggregated_set?.nutrients
    ) {
      const nutrients = productDetails.product.nutrition.aggregated_set.nutrients;
      return {
        calories: nutrients?.['energy-kcal']?.value || 0,
        protein: nutrients?.proteins?.value || 0,
        carbs: nutrients?.carbohydrates?.value || 0,
        fat: nutrients?.fat?.value || 0,
        fiber: nutrients?.fiber?.value || 0,
        sugars: nutrients?.sugars?.value || 0,
        saturatedFat: nutrients?.['saturated-fat']?.value || 0,
        sodium: nutrients?.sodium?.value || 0,
        salt: nutrients?.salt?.value || 0,
      };
    }

    // If we have nutriments from the search result
    if (nutriments) {
      return {
        calories: nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || food.calories,
        protein: nutriments['proteins_100g'] || nutriments['proteins'] || food.protein,
        carbs: nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || food.carbs,
        fat: nutriments['fat_100g'] || nutriments['fat'] || food.fat,
        fiber: nutriments['fiber_100g'] || nutriments['fiber'] || 0,
        sugars: nutriments['sugars_100g'] || nutriments['sugars'] || 0,
        saturatedFat: nutriments['saturated-fat_100g'] || nutriments['saturated-fat'] || 0,
        sodium: nutriments['sodium_100g'] || nutriments['sodium'] || 0,
        salt: nutriments['salt_100g'] || nutriments['salt'] || 0,
      };
    }

    // Fallback to original food data
    return {
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: 0,
      sugars: 0,
      saturatedFat: 0,
      sodium: 0,
      salt: 0,
    };
  };

  const nutritionalData = getNutritionalData();

  // Get product name from API if available
  const getProductName = () => {
    if (isSuccessFoodProductState(productDetails) && productDetails.product.product_name) {
      return productDetails.product.product_name;
    }
    if (_raw?.product_name) {
      return _raw.product_name;
    }
    return food.name;
  };

  // Get product category/brand from API if available
  const getProductCategory = () => {
    const brand = isSuccessFoodProductState(productDetails)
      ? productDetails.product.brands
      : _raw?.brands;
    const categories = isSuccessFoodProductState(productDetails)
      ? productDetails.product.categories
      : _raw?.categories;

    if (brand && categories) {
      return `${brand} • ${categories}`;
    }
    if (brand) {
      return brand;
    }
    if (categories) {
      return categories;
    }
    return food.category;
  };

  // Get default serving size from API if available
  const getDefaultServingSize = () => {
    const apiServingSize = isSuccessFoodProductState(productDetails)
      ? productDetails.product.serving_size
      : serving_size;
    if (apiServingSize) {
      // Extract numeric value from serving size (e.g., "1 loaf (30 g)" -> 30)
      const match = apiServingSize.match(/\((\d+)\s*g\)/);
      if (match) {
        return parseInt(match[1]);
      }
      const numericMatch = apiServingSize.match(/(\d+)/);
      if (numericMatch) {
        return parseInt(numericMatch[1]);
      }
    }
    return 100; // Default to 100g
  };

  // Update serving size when product details load
  useEffect(() => {
    if (productDetails || nutriments) {
      const defaultSize = getDefaultServingSize();
      setServingSize(defaultSize);
    }
  }, [productDetails, nutriments, getDefaultServingSize]);

  // Calculate nutritional values based on serving size
  const getScaledNutrition = () => {
    const scaleFactor = servingSize / 100; // API data is per 100g
    return {
      name: getProductName(),
      category: getProductCategory(),
      calories: Math.round(nutritionalData.calories * scaleFactor),
      protein: Math.round(nutritionalData.protein * scaleFactor * 10) / 10,
      carbs: Math.round(nutritionalData.carbs * scaleFactor * 10) / 10,
      fat: Math.round(nutritionalData.fat * scaleFactor * 10) / 10,
    };
  };

  const scaledFood = getScaledNutrition();

  const mealTabs = [
    { id: 'breakfast', label: t('food.meals.breakfast') },
    { id: 'lunch', label: t('food.meals.lunch') },
    { id: 'dinner', label: t('food.meals.dinner') },
    { id: 'snack', label: t('food.meals.snacks') },
    { id: 'other', label: t('food.meals.trackOther') },
  ];

  const handleAddFood = async () => {
    try {
      let foodId: string;

      if (source === 'api' && _raw) {
        // This is an API food, save it to local database first
        const newFood = await FoodService.createFromV3Product(_raw, {
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

        foodId = newFood.id;
      } else {
        // This is a local food, we need to find its ID
        // For now, we'll assume the food object has an id or we need to search for it
        // This is a limitation - ideally the parent component should pass the food ID
        if ('id' in food && typeof food.id === 'string') {
          foodId = food.id;
        } else {
          // Try to find the food by name (this is not ideal but a fallback)
          const existingFoods = await FoodService.searchFoods(food.name);
          const matchingFood = existingFoods.find((f) => f.name === food.name);
          if (!matchingFood) {
            throw new Error('Local food not found in database');
          }
          foodId = matchingFood.id;
        }
      }

      // Create nutrition log
      await NutritionService.logFood(
        foodId,
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
  };

  return (
    <FullScreenModal
      visible={visible}
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
  );
}
