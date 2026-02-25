import { format, isSameDay } from 'date-fns';
import { BookmarkPlus, Calendar, Edit, PlusCircle } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import type { DecryptedNutritionLogSnapshot, MealType } from '../../database/models';
import Food from '../../database/models/Food';
import Meal from '../../database/models/Meal';
import { FoodService, MealService, NutritionService } from '../../database/services';
import { useFoodProductDetails } from '../../hooks/useFoodProductDetails';
import { useTheme } from '../../hooks/useTheme';
import { isSuccessFoodDetailProductState } from '../../types/guards/openFoodFacts';
import type { SearchResultProduct } from '../../types/openFoodFacts';
import { mapOpenFoodFactsProduct } from '../../utils/openFoodFactsMapper';
import { FoodInfoCard } from '../cards/FoodInfoCard';
import { FilterTabs } from '../FilterTabs';
import { ServingSizeSelector } from '../ServingSizeSelector';
import { useSnackbar } from '../SnackbarContext';
import { Button } from '../theme/Button';
import { DatePickerModal } from './DatePickerModal';
import { FoodNotFoundModal } from './FoodNotFoundModal';
import { FullScreenModal } from './FullScreenModal';

type FoodDetailsModalProps = {
  visible: boolean;
  foodLog?: any;
  onClose: () => void;
  barcode?: string | null;
  /** Preloaded product from OFF search (avoids barcode fetch on mobile) */
  productFromSearch?: SearchResultProduct | null;
  food?: Food | null;
  meal?: Meal | null;
  initialMealType?: MealType;
  /** When adding food (not editing a log), use this as the default log date (e.g. date from food screen). */
  initialDate?: Date;
  onAddFood?: (data: { servingSize: number; meal: string; date: Date }) => void;
  onLogMeal?: (data: { meal: string; date: Date }) => void;
  /** Called when barcode lookup has finished (product found or not). Used to hide camera loading overlay. */
  onBarcodeLookupComplete?: () => void;
};

export function FoodMealDetailsModal({
  visible,
  onClose,
  barcode,
  productFromSearch,
  food,
  meal,
  initialMealType,
  initialDate,
  onAddFood,
  onLogMeal,
  foodLog,
  onBarcodeLookupComplete,
}: FoodDetailsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [servingSize, setServingSize] = useState(100);
  const [mealPortionMultiplier, setMealPortionMultiplier] = useState(1);
  const [selectedMeal, setSelectedMeal] = useState<MealType>(initialMealType ?? 'lunch');
  const [selectedDate, setSelectedDate] = useState(() =>
    initialDate ? new Date(initialDate) : new Date()
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isFoodNotFoundModalVisible, setIsFoodNotFoundModalVisible] = useState(false);
  const [isFoodDetailsModalVisible, setIsFoodDetailsModalVisible] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [mealNutrients, setMealNutrients] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  } | null>(null);
  const [isLoadingMealNutrients, setIsLoadingMealNutrients] = useState(false);
  const [foodLogDecrypted, setFoodLogDecrypted] = useState<DecryptedNutritionLogSnapshot | null>(
    null
  );

  // Determine mode: 'food' | 'foodLog' | 'meal' | 'barcode'
  const mode = meal
    ? 'meal'
    : foodLog
      ? 'foodLog'
      : food
        ? 'food'
        : barcode || productFromSearch
          ? 'barcode'
          : null;

  // When opening in "add" mode (not editing a log), apply initialDate from parent (e.g. food screen).
  useEffect(() => {
    if (visible && initialDate && !foodLog) {
      setSelectedDate(new Date(initialDate));
    }
  }, [visible, initialDate, foodLog]);

  // Fetch detailed product data only when barcode is provided, no local food, and no preloaded search product
  const { data: productDetails } = useFoodProductDetails(
    barcode && !food && !meal && !productFromSearch ? barcode : null
  );

  // When opened with barcode only (no product yet), show modal immediately so it's visible on Android
  // while productDetails loads. Otherwise the inner FullScreenModal stays hidden until the effect below runs.
  useEffect(() => {
    if (visible && barcode && !food && !meal && !productFromSearch) {
      setIsFoodDetailsModalVisible(true);
    }
  }, [visible, barcode, food, meal, productFromSearch]);

  // Get default serving size from search result or barcode lookup (never return 0 – OFF data is per 100g)
  const getDefaultServingSize = useCallback(() => {
    const servingStr =
      productFromSearch?.serving_size ??
      (isSuccessFoodDetailProductState(productDetails)
        ? productDetails.product.serving_size
        : null);
    if (servingStr) {
      const match = String(servingStr).match(/\((\d+)\s*g\)/);
      if (match) {
        const g = parseInt(match[1], 10);
        if (g > 0) {
          return g;
        }
      }
      const num = String(servingStr).match(/(\d+)/);
      if (num) {
        const g = parseInt(num[1], 10);
        if (g > 0) {
          return g;
        }
      }
    }
    return 100; // Default to 100g when missing or "0 g"
  }, [productDetails, productFromSearch]);

  useEffect(() => {
    if (meal) {
      // Meal mode: load nutrients and show details
      setIsFoodDetailsModalVisible(true);
      setIsFavorite(meal.isFavorite);
      return;
    }

    if (food) {
      // Local food already available, show details
      setIsFoodDetailsModalVisible(true);
      setServingSize(100);
      return;
    }

    // Use preloaded search result (no network fetch) – fixes Android modal not opening
    if (productFromSearch?.product_name && productFromSearch?.nutriments) {
      setIsFoodDetailsModalVisible(true);
      const defaultG = getDefaultServingSize(); // uses 100 when serving_size is "0 g" or invalid
      setServingSize(defaultG);
      onBarcodeLookupComplete?.();
      return;
    }

    if (productDetails) {
      if (productDetails?.status !== 'success') {
        setIsFoodNotFoundModalVisible(true);
      } else {
        setIsFoodDetailsModalVisible(true);
      }
      onBarcodeLookupComplete?.();
    }
  }, [
    productDetails,
    productFromSearch,
    food,
    meal,
    getDefaultServingSize,
    onBarcodeLookupComplete,
  ]);

  // Load meal nutrients when meal is provided
  useEffect(() => {
    if (!meal) {
      setMealNutrients(null);
      return;
    }

    const loadMealNutrients = async () => {
      setIsLoadingMealNutrients(true);
      try {
        const nutrients = await meal.getTotalNutrients();
        setMealNutrients({
          calories: Math.round(nutrients.calories),
          protein: Math.round(nutrients.protein * 10) / 10,
          carbs: Math.round(nutrients.carbs * 10) / 10,
          fat: Math.round(nutrients.fat * 10) / 10,
          fiber: Math.round(nutrients.fiber * 10) / 10,
        });
      } catch (error) {
        console.error('Error loading meal nutrients:', error);
        setMealNutrients({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
      } finally {
        setIsLoadingMealNutrients(false);
      }
    };

    loadMealNutrients();
  }, [meal]);

  // If we are given a foodLog, initialize edit mode values from it and load decrypted snapshot
  useEffect(() => {
    if (!foodLog) {
      setFoodLogDecrypted(null);
      return;
    }

    setIsFoodDetailsModalVisible(true);

    try {
      setSelectedMeal(foodLog.type || 'other');
    } catch (e) {
      setSelectedMeal('lunch');
    }

    try {
      setSelectedDate(new Date(foodLog.date));
    } catch (e) {
      setSelectedDate(new Date());
    }

    let cancelled = false;
    foodLog.getDecryptedSnapshot().then((snap: DecryptedNutritionLogSnapshot) => {
      if (!cancelled) {
        setFoodLogDecrypted(snap);
      }
    });

    (async () => {
      try {
        const grams = await foodLog.getGramWeight();
        if (!cancelled && typeof grams === 'number' && !Number.isNaN(grams)) {
          setServingSize(Math.round(grams));
        }
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [foodLog]);

  // Extract nutritional data from meal, barcode lookup, local food, or log snapshot
  const getNutritionalData = useCallback(() => {
    // If we have a meal, use its nutrients
    if (meal && mealNutrients) {
      return {
        calories: mealNutrients.calories,
        protein: mealNutrients.protein,
        carbs: mealNutrients.carbs,
        fat: mealNutrients.fat,
        fiber: mealNutrients.fiber,
        sugar: 0, // Meals don't track sugar separately
        saturatedFat: 0, // Meals don't track saturated fat separately
        sodium: 0, // Meals don't track sodium separately
      };
    }

    // If we have a foodLog but no food (e.g. food deleted), use decrypted snapshot per 100g
    const hasSnapshot =
      foodLogDecrypted &&
      typeof foodLogDecrypted.loggedCalories === 'number' &&
      !Number.isNaN(foodLogDecrypted.loggedCalories);
    if (foodLog && !food && hasSnapshot && foodLogDecrypted) {
      return {
        calories: foodLogDecrypted.loggedCalories ?? 0,
        protein: foodLogDecrypted.loggedProtein ?? 0,
        carbs: foodLogDecrypted.loggedCarbs ?? 0,
        fat: foodLogDecrypted.loggedFat ?? 0,
        fiber: foodLogDecrypted.loggedFiber ?? 0,
        sugar: foodLogDecrypted.loggedMicros?.sugar ?? 0,
        saturatedFat: foodLogDecrypted.loggedMicros?.saturatedFat ?? 0,
        sodium: foodLogDecrypted.loggedMicros?.sodium ?? 0,
      };
    }

    // If we have a local food, use its data directly
    if (food) {
      return {
        calories: food.calories || 0,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
        fiber: food.fiber || 0,
        sugar: food.micros?.sugar || 0,
        saturatedFat: food.micros?.saturatedFat || 0,
        sodium: food.micros?.sodium || 0,
      };
    }

    // Use the comprehensive mapping function for Open Food Facts products
    if (productFromSearch?.nutriments) {
      const mappedProduct = mapOpenFoodFactsProduct(productFromSearch);
      return {
        calories: mappedProduct.calories || 0,
        protein: mappedProduct.protein || 0,
        carbs: mappedProduct.carbs || 0,
        fat: mappedProduct.fat || 0,
        fiber: mappedProduct.fiber || 0,
        sugar: mappedProduct.nutriments?.macronutrients?.sugars || 0,
        saturatedFat: mappedProduct.nutriments?.macronutrients?.saturatedFat || 0,
        sodium:
          mappedProduct.nutriments?.minerals?.sodium || mappedProduct.nutriments?.other?.salt || 0,
      };
    }

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
        sugar: (nutrients['sugars'] as number) || 0,
        saturatedFat: (nutrients['saturated-fat'] as number) || 0,
        sodium: (nutrients['sodium'] as number) || (nutrients['salt'] as number) || 0, // salt contains sodium, use sodium if available, otherwise salt
      };
    }

    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
    };
  }, [productDetails, productFromSearch, food, foodLog, foodLogDecrypted, meal, mealNutrients]);

  const nutritionalData = getNutritionalData();

  // Get product name from meal, barcode lookup, search result, local food, or log snapshot
  const getProductName = useCallback(() => {
    if (meal) {
      return meal.name || t('meals.history.unknownMeal');
    }

    if (food) {
      return food.name || t('food.unknownFood');
    }

    if (foodLogDecrypted?.loggedFoodName?.trim()) {
      return foodLogDecrypted.loggedFoodName.trim();
    }

    if (productFromSearch?.product_name) {
      return productFromSearch.product_name;
    }

    if (isSuccessFoodDetailProductState(productDetails)) {
      return productDetails.product.product_name || t('food.unknownFood');
    }
    return t('food.unknownFood');
  }, [productDetails, productFromSearch, food, foodLogDecrypted, meal, t]);

  // Get product category/brand from meal, barcode lookup, search result, or local food
  const getProductCategory = useCallback(() => {
    if (meal) {
      return meal.description || t('meals.customMeal');
    }

    if (food) {
      return food.brand || '';
    }

    if (foodLog && !food) {
      return '';
    }

    if (productFromSearch) {
      const brand = productFromSearch.brands;
      const categories = productFromSearch.categories;
      if (brand && categories) {
        return `${brand} • ${categories}`;
      }
      if (brand) {
        return brand;
      }
      if (categories) {
        return categories;
      }
      return '';
    }

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
  }, [productDetails, productFromSearch, food, foodLog, meal, t]);

  // Update serving size when product details or search product load
  useEffect(() => {
    if (productFromSearch || productDetails) {
      const defaultSize = getDefaultServingSize();
      setServingSize(defaultSize);
    }
  }, [productFromSearch, productDetails, getDefaultServingSize]);

  // Calculate nutritional values based on serving size (for foods) or use meal nutrients directly
  const getScaledNutrition = useCallback(() => {
    // For meals, scale nutrients by portion multiplier
    if (meal && mealNutrients) {
      return {
        name: getProductName(),
        category: getProductCategory(),
        calories: Math.round(mealNutrients.calories * mealPortionMultiplier),
        protein: Math.round(mealNutrients.protein * mealPortionMultiplier * 10) / 10,
        carbs: Math.round(mealNutrients.carbs * mealPortionMultiplier * 10) / 10,
        fat: Math.round(mealNutrients.fat * mealPortionMultiplier * 10) / 10,
      };
    }

    // For foods, scale by serving size
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
    meal,
    mealNutrients,
    mealPortionMultiplier,
    nutritionalData.calories,
    nutritionalData.carbs,
    nutritionalData.fat,
    nutritionalData.protein,
    servingSize,
  ]);

  const scaledFood = getScaledNutrition();

  const mealTabs: { id: MealType; label: string }[] = [
    { id: 'breakfast', label: t('food.meals.breakfast') },
    { id: 'lunch', label: t('food.meals.lunch') },
    { id: 'dinner', label: t('food.meals.dinner') },
    { id: 'snack', label: t('food.meals.snacks') },
    { id: 'other', label: t('food.meals.trackOther') },
  ];

  const handleAddFood = useCallback(async () => {
    setIsAddingFood(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      // Handle meal logging
      if (meal) {
        try {
          // Get meal with its foods
          const mealWithFoods = await MealService.getMealWithFoods(meal.id);

          if (!mealWithFoods) {
            throw new Error('Failed to get meal foods');
          }

          // Log each food in the meal, scaled by the portion multiplier
          for (const mealFood of mealWithFoods.foods) {
            await NutritionService.logFood(
              mealFood.foodId,
              selectedDate,
              selectedMeal,
              mealFood.amount * mealPortionMultiplier,
              mealFood.portionId
            );
          }

          // Update favorite status if needed
          if (isFavorite && !meal.isFavorite) {
            await MealService.toggleMealFavorite(meal.id);
          } else if (!isFavorite && meal.isFavorite) {
            await MealService.toggleMealFavorite(meal.id);
          }

          // Call callback if provided
          onLogMeal?.({ meal: selectedMeal, date: selectedDate });

          onClose();

          showSnackbar('success', t('food.foodDetails.successMessage'), {
            action: t('snackbar.ok'),
          });
        } catch (err) {
          console.error('Error logging meal:', err);
          showSnackbar('error', t('food.foodDetails.errorMessage'), {
            action: t('snackbar.ok'),
          });
        } finally {
          setIsAddingFood(false);
        }

        return;
      }

      // If editing an existing food log, update it instead of creating a new one
      if (foodLog) {
        try {
          await Promise.all([
            // Update amount in grams (set portion to undefined so amount is grams)
            foodLog.updateAmount(servingSize),
            foodLog.updateMealType(selectedMeal),
            foodLog.updatePortion(undefined),
          ]);

          // Call callback if provided
          onAddFood?.({ servingSize, meal: selectedMeal, date: selectedDate });

          onClose();

          showSnackbar('success', t('food.foodDetails.successMessage'), {
            action: t('snackbar.ok'),
          });
        } catch (err) {
          console.error('Error updating food log:', err);
          showSnackbar('error', t('food.foodDetails.errorMessage'), {
            action: t('snackbar.ok'),
          });
        } finally {
          setIsAddingFood(false);
        }

        return;
      }
      // Handle local food
      if (food) {
        // Create nutrition log with local food
        const logFoodPromise = NutritionService.logFood(
          food.id,
          selectedDate,
          selectedMeal,
          servingSize
        );
        let foodUpdatePromise = null;

        // Update favorite status if needed
        if (isFavorite && !food.isFavorite) {
          foodUpdatePromise = food.update((record: any) => {
            record.isFavorite = true;
          });
        }

        await Promise.all([
          logFoodPromise,
          foodUpdatePromise,
          new Promise((resolve) => setTimeout(resolve, 100)),
        ]);

        // Call the original callback if provided
        onAddFood?.({
          servingSize,
          meal: selectedMeal,
          date: selectedDate,
        });

        onClose();

        showSnackbar('success', t('food.foodDetails.successMessage'), {
          action: t('snackbar.ok'),
        });
        return;
      }

      // Handle API food: use preloaded search product or barcode-fetched product
      const productToSave =
        productFromSearch ??
        (isSuccessFoodDetailProductState(productDetails) ? productDetails.product : null);
      if (!productToSave) {
        throw new Error('Product details not loaded');
      }

      // Save product to local database (search result has same shape as V3 for our usage)
      const newFood = await FoodService.createFromV3Product(productToSave as any, {
        calories: nutritionalData.calories,
        protein: nutritionalData.protein,
        carbs: nutritionalData.carbs,
        fat: nutritionalData.fat,
        fiber: nutritionalData.fiber,
        sugar: nutritionalData.sugar,
        saturatedFat: nutritionalData.saturatedFat,
        sodium: nutritionalData.sodium,
        isFavorite: isFavorite,
      });

      // Create nutrition log
      const logFoodPromise = NutritionService.logFood(
        newFood.id,
        selectedDate,
        selectedMeal as MealType,
        servingSize
      );

      await Promise.all([logFoodPromise, new Promise((resolve) => setTimeout(resolve, 100))]);

      // Call the original callback if provided
      onAddFood?.({
        servingSize,
        meal: selectedMeal,
        date: selectedDate,
      });

      onClose();

      showSnackbar('success', t('food.foodDetails.successMessage'), {
        action: t('snackbar.ok'),
      });
    } catch (error) {
      console.error('Error tracking food:', error);

      showSnackbar('error', t('food.foodDetails.errorMessage'), {
        action: t('snackbar.ok'),
      });
    } finally {
      setIsAddingFood(false);
    }
  }, [
    meal,
    foodLog,
    food,
    productFromSearch,
    productDetails,
    nutritionalData.calories,
    nutritionalData.protein,
    nutritionalData.carbs,
    nutritionalData.fat,
    nutritionalData.fiber,
    nutritionalData.sugar,
    nutritionalData.saturatedFat,
    nutritionalData.sodium,
    isFavorite,
    selectedDate,
    selectedMeal,
    servingSize,
    mealPortionMultiplier,
    onAddFood,
    onClose,
    showSnackbar,
    t,
    onLogMeal,
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

  const actionLabel = meal
    ? t('meals.logMeal')
    : foodLog
      ? t('food.foodDetails.updateFood')
      : t('food.foodDetails.addFood');

  return (
    <>
      <FullScreenModal
        visible={isFoodDetailsModalVisible}
        onClose={onClose}
        title={meal ? t('food.foodDetails.mealTitle') : t('food.foodDetails.foodTitle')}
        scrollable={true}
        headerRight={
          mode !== 'meal' ? (
            <Pressable
              onPress={() => setIsFavorite(!isFavorite)}
              className="flex-row items-center gap-1"
            >
              <BookmarkPlus
                size={theme.iconSize.sm}
                color={theme.colors.accent.primary}
                fill={isFavorite ? theme.colors.accent.primary : 'none'}
              />
              <Text className="text-sm font-medium text-accent-primary">
                {t('food.foodDetails.addFavorite')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setIsFavorite(!isFavorite)}
              className="flex-row items-center gap-1"
            >
              <BookmarkPlus
                size={theme.iconSize.sm}
                color={theme.colors.accent.primary}
                fill={isFavorite ? theme.colors.accent.primary : 'none'}
              />
              <Text className="text-sm font-medium text-accent-primary">
                {t('food.foodDetails.addFavorite')}
              </Text>
            </Pressable>
          )
        }
        footer={
          <View className="pb-6">
            <Button
              label={actionLabel}
              icon={PlusCircle}
              variant="gradientCta"
              size="sm"
              width="full"
              onPress={handleAddFood}
              disabled={isAddingFood}
              loading={isAddingFood}
            />
          </View>
        }
      >
        <View className="flex-1 px-4 pb-6">
          {/* Food Info Card */}
          <View className="mt-6">
            <FoodInfoCard food={scaledFood} />

            {/* Additional Nutritional Info - only show for foods, not meals */}
            {mode !== 'meal' &&
            ((nutritionalData.fiber ?? 0) > 0 ||
              (nutritionalData.sugar ?? 0) > 0 ||
              (nutritionalData.saturatedFat ?? 0) > 0 ||
              (nutritionalData.sodium ?? 0) > 0) ? (
              <View className="mt-4 rounded-2xl border border-border-light bg-bg-overlay p-4">
                <Text className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">
                  {t('food.foodDetails.additionalNutrition')}
                </Text>
                <View className="gap-2">
                  {nutritionalData.fiber > 0 ? (
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-text-secondary">{t('food.macros.fiber')}</Text>
                      <Text className="text-sm font-medium text-text-primary">
                        {Math.round(nutritionalData.fiber * (servingSize / 100) * 10) / 10}g
                      </Text>
                    </View>
                  ) : null}
                  {(nutritionalData.sugar ?? 0) > 0 ? (
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-text-secondary">
                        {t('food.foodDetails.sugars')}
                      </Text>
                      <Text className="text-sm font-medium text-text-primary">
                        {Math.round((nutritionalData.sugar ?? 0) * (servingSize / 100) * 10) / 10}g
                      </Text>
                    </View>
                  ) : null}
                  {nutritionalData.saturatedFat > 0 ? (
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-text-secondary">
                        {t('food.foodDetails.saturatedFat')}
                      </Text>
                      <Text className="text-sm font-medium text-text-primary">
                        {Math.round(nutritionalData.saturatedFat * (servingSize / 100) * 10) / 10}g
                      </Text>
                    </View>
                  ) : null}
                  {nutritionalData.sodium > 0 ? (
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-text-secondary">
                        {t('food.foodDetails.salt')}
                      </Text>
                      <Text className="text-sm font-medium text-text-primary">
                        {Math.round(nutritionalData.sodium * (servingSize / 100) * 1000) / 1000}g
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {/* Form Sections */}
          <View className="gap-6">
            {/* Serving Size - only show for foods, not meals */}
            {mode !== 'meal' ? (
              <ServingSizeSelector value={servingSize} onChange={setServingSize} />
            ) : (
              /* Portion Selector - only for meals */
              <View className="mt-6 w-full">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
                  {t('food.foodDetails.portionSize')}
                </Text>
                <View
                  className="rounded-xl border bg-bg-cardDark p-3"
                  style={{ borderColor: theme.colors.background.white10 }}
                >
                  {/* Multiplier Stepper */}
                  <View className="mb-4 flex-row items-center gap-3">
                    <Pressable
                      className="h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-bg-overlay"
                      style={{ borderColor: theme.colors.background.white5 }}
                      onPress={() =>
                        setMealPortionMultiplier((prev) =>
                          Math.max(0.25, Math.round((prev - 0.25) * 100) / 100)
                        )
                      }
                    >
                      <Text className="text-2xl font-bold text-text-secondary">−</Text>
                    </Pressable>
                    <View className="flex-1 items-center justify-center">
                      <Text className="text-4xl font-black text-text-primary">
                        {mealPortionMultiplier % 1 === 0
                          ? `${mealPortionMultiplier}`
                          : `${mealPortionMultiplier}`}
                      </Text>
                      <Text className="mt-1 text-xs text-text-secondary">
                        {t('food.foodDetails.servings')}
                      </Text>
                    </View>
                    <Pressable
                      className="h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-accent-primary/20 bg-accent-primary/10"
                      onPress={() =>
                        setMealPortionMultiplier((prev) => Math.round((prev + 0.25) * 100) / 100)
                      }
                    >
                      <Text className="text-2xl font-bold text-accent-primary">+</Text>
                    </Pressable>
                  </View>
                  {/* Quick Presets */}
                  <View className="flex-row justify-center gap-2 pb-1">
                    {[0.5, 1, 1.5, 2].map((preset) => (
                      <Pressable
                        key={preset}
                        className="rounded-full border px-4"
                        style={{
                          paddingVertical: theme.spacing.padding['1half'],
                          backgroundColor:
                            mealPortionMultiplier === preset
                              ? theme.colors.accent.primary10
                              : 'transparent',
                          borderColor:
                            mealPortionMultiplier === preset
                              ? theme.colors.accent.primary20
                              : theme.colors.background.white5,
                        }}
                        onPress={() => setMealPortionMultiplier(preset)}
                      >
                        <Text
                          className="text-xs font-medium"
                          style={{
                            color:
                              mealPortionMultiplier === preset
                                ? theme.colors.accent.primary
                                : theme.colors.text.secondary,
                            fontWeight: mealPortionMultiplier === preset ? '700' : '500',
                          }}
                        >
                          {preset === 0.5 ? '½' : preset === 1 ? '1' : preset === 1.5 ? '1½' : '2'}×
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Meal Selection */}
            <View>
              <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">
                {t('food.foodDetails.meal')}
              </Text>
              <FilterTabs
                tabs={mealTabs}
                activeTab={selectedMeal}
                onTabChange={(tabId) => setSelectedMeal(tabId as MealType)}
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
        {isDatePickerVisible ? (
          <DatePickerModal
            visible={isDatePickerVisible}
            onClose={() => setIsDatePickerVisible(false)}
            selectedDate={selectedDate}
            onDateSelect={(date) => {
              setSelectedDate(date);
              setIsDatePickerVisible(false);
            }}
          />
        ) : null}
      </FullScreenModal>
    </>
  );
}
