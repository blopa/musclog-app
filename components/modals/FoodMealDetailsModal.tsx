import { format, isSameDay } from 'date-fns';
import {
  BarChart,
  BookmarkPlus,
  Calendar,
  Cookie,
  Droplet,
  Dumbbell,
  Edit,
  Edit3,
  Pencil,
  PlusCircle,
  RefreshCcwDot,
  ScanLine,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

import type { Units } from '../../constants/settings';
import type { DecryptedNutritionLogSnapshot, MealType } from '../../database/models';
import Food from '../../database/models/Food';
import FoodPortion from '../../database/models/FoodPortion';
import Meal from '../../database/models/Meal';
import {
  FoodPortionService,
  FoodService,
  MealService,
  NutritionService,
} from '../../database/services';
import { useFoodProductDetails } from '../../hooks/useFoodProductDetails';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import {
  isMappedNutriments,
  isSuccessFoodDetailProductState,
} from '../../types/guards/openFoodFacts';
import type { SearchResultProduct } from '../../types/openFoodFacts';
import {
  getNutrimentsFromV3Nutrition,
  getNutrimentsWithFallback,
  getNutrimentValue,
  getProductName,
  mapOpenFoodFactsProduct,
} from '../../utils/openFoodFactsMapper';
import { getMassUnitLabel, gramsToDisplay } from '../../utils/unitConversion';
import { mapUSDAFoodToUnified, mapUSDANutritient } from '../../utils/usdaMapper';
import { BottomPopUp } from '../BottomPopUp';
import { FoodInfoCard } from '../cards/FoodInfoCard';
import { FilterTabs } from '../FilterTabs';
import { MacroInput } from '../MacroInput';
import { ServingSizeSelector } from '../ServingSizeSelector';
import { useSnackbar } from '../SnackbarContext';
import { Button } from '../theme/Button';
import { TextInput } from '../theme/TextInput';
import { BarcodeCameraModal } from './BarcodeCameraModal';
import { DatePickerModal } from './DatePickerModal';
import { FoodNotFoundModal } from './FoodNotFoundModal';
import { FullScreenModal } from './FullScreenModal';

type FoodDetailsModalProps = {
  visible: boolean;
  foodLog?: any;
  onClose: () => void;
  barcode?: string | null;
  /** Preloaded product from search (avoids barcode fetch on mobile) */
  productFromSearch?: any;
  food?: Food | null;
  meal?: Meal | null;
  initialMealType?: MealType;
  /** When adding food (not editing a log), use this as the default log date (e.g. date from food screen). */
  initialDate?: Date;
  /** Initial serving size in grams for duplicate mode */
  initialServingSize?: number;
  source?: 'openfood' | 'usda' | 'local' | 'ai' | 'foundation';
  onAddFood?: (data: { servingSize: number; meal: string; date: Date }) => void;
  onLogMeal?: (data: { meal: string; date: Date }) => void;
  /** Called when barcode lookup has finished (product found or not). Used to hide camera loading overlay. */
  onBarcodeLookupComplete?: () => void;
  /** Called when food was successfully tracked (e.g. so parent can close camera modal). */
  onFoodTracked?: () => void;
  /** When false, the "Try AI Camera" option in FoodNotFoundModal is hidden. Defaults to true. */
  isAiEnabled?: boolean;
  /** When true, show an edit control so the user can correct name, barcode, and macros (e.g. for AI-sourced data). */
  canEdit?: boolean;
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
  initialServingSize,
  source: initialSource,
  onAddFood,
  onLogMeal,
  foodLog,
  onBarcodeLookupComplete,
  onFoodTracked,
  isAiEnabled = true,
  canEdit = false,
}: FoodDetailsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { units } = useSettings();

  // Infer meal type from current time of day when no initialMealType is passed
  const inferMealTypeFromTime = (): MealType => {
    const currentHour = new Date().getHours();

    if (currentHour >= 5 && currentHour < 11) {
      return 'breakfast';
    } else if (currentHour >= 11 && currentHour < 15) {
      return 'lunch';
    } else if (currentHour >= 15 && currentHour < 21) {
      return 'dinner';
    } else {
      return 'snack';
    }
  };

  const [servingSize, setServingSize] = useState(100);
  const [mealPortionMultiplier, setMealPortionMultiplier] = useState(1);
  /** Total weight of the meal in grams (sum of all ingredients). Used when tracking a saved meal. */
  const [totalMealGrams, setTotalMealGrams] = useState(0);
  /** Amount in grams to log (user-editable). Defaults to totalMealGrams so "1 full meal". */
  const [mealAmountGrams, setMealAmountGrams] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<MealType>(
    initialMealType ?? inferMealTypeFromTime()
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    initialDate ? new Date(initialDate) : new Date()
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isFoodNotFoundModalVisible, setIsFoodNotFoundModalVisible] = useState(false);
  const [isFoodDetailsModalVisible, setIsFoodDetailsModalVisible] = useState(
    () => !!meal || !!food || !!foodLog || !!productFromSearch
  );

  // Ensure modal opens immediately if we have enough data from search
  useEffect(() => {
    if (!isFoodDetailsModalVisible && (!!productFromSearch || !!meal || !!food || !!foodLog)) {
      setIsFoodDetailsModalVisible(true);
    }
  }, [productFromSearch, isFoodDetailsModalVisible, meal, food, foodLog]);
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
  const [localFood, setLocalFood] = useState<Food | null>(null);
  const [hasCheckedLocalFood, setHasCheckedLocalFood] = useState(false);
  const [matchedPortion, setMatchedPortion] = useState<FoodPortion | null>(null); // Store matched portion for new foods
  /** User edits to AI-sourced product (name, barcode, per-100g macros). */
  const [editedOverrides, setEditedOverrides] = useState<{
    name?: string;
    barcode?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  } | null>(null);
  const [isEditPopUpVisible, setIsEditPopUpVisible] = useState(false);
  const [showBarcodeScannerInEdit, setShowBarcodeScannerInEdit] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    barcode: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
  } | null>(null);

  // Helper function to determine the mode based on available data
  const getMode = (): 'meal' | 'foodLog' | 'food' | 'barcode' | null => {
    if (meal) {
      return 'meal';
    }

    if (foodLog) {
      return 'foodLog';
    }

    if (food) {
      return 'food';
    }

    if (barcode || productFromSearch) {
      return 'barcode';
    }

    return null;
  };

  const mode = getMode();

  // When opening in "add" mode (not editing a log), apply initialDate from parent (e.g. food screen).
  useEffect(() => {
    if (visible && initialDate && !foodLog) {
      setSelectedDate(new Date(initialDate));
    }
  }, [visible, initialDate, foodLog]);

  // When opening in duplicate mode, apply initial serving size
  useEffect(() => {
    if (visible && initialServingSize && !foodLog) {
      setServingSize(initialServingSize);
    }
  }, [visible, initialServingSize, foodLog]);

  // Check local database for food with barcode first
  useEffect(() => {
    // Reset checking state when barcode changes
    setHasCheckedLocalFood(false);
    setLocalFood(null);
    setMatchedPortion(null); // Reset matched portion

    const checkLocalFood = async () => {
      if (barcode && !food && !meal && !productFromSearch) {
        try {
          const foundFood = await FoodService.getFoodByBarcode(barcode);
          if (foundFood) {
            setLocalFood(foundFood);
            onBarcodeLookupComplete?.();
          }
        } catch (error) {
          console.error('Error checking local food by barcode:', error);
        }
      } else {
        setLocalFood(null);
      }
      setHasCheckedLocalFood(true);
    };

    checkLocalFood();
  }, [barcode, food, meal, productFromSearch, onBarcodeLookupComplete]);

  // Fetch detailed product data only when barcode is provided, no local food, no preloaded search product, and we've checked local DB
  const barcodeForHook =
    barcode && !food && !meal && !productFromSearch && !localFood && hasCheckedLocalFood
      ? barcode
      : null;

  const usdaIdForHook =
    !barcode &&
    !food &&
    !meal &&
    productFromSearch?.fdcId &&
    !localFood &&
    (productFromSearch?.source === 'usda' || initialSource === 'usda')
      ? productFromSearch.fdcId
      : null;

  const { data: productDetails, isLoading: isLoadingDetails } = useFoodProductDetails(
    barcodeForHook,
    usdaIdForHook
  );

  // Helper function to generate portion name based on serving size and units
  const generatePortionName = useCallback((servingSizeGrams: number, units: Units): string => {
    if (servingSizeGrams === 100) {
      const unitLabel = getMassUnitLabel(units);
      return units === 'imperial' ? `3.5${unitLabel}` : `100${unitLabel}`;
    }

    const displayWeight = gramsToDisplay(servingSizeGrams, units);
    const unitLabel = getMassUnitLabel(units);
    return `${displayWeight}${unitLabel}`;
  }, []);

  // Get default serving size from search result or barcode lookup (never return 0 – OFF data is per 100g)
  const matchServingSizeToPortion = useCallback(
    async (servingSizeGrams: number) => {
      try {
        // Get all existing portions to find a match
        const allPortions = await FoodPortionService.getAllPortions();

        // First try to find exact match
        const exactMatch = allPortions.find((p) => p.gramWeight === servingSizeGrams);
        if (exactMatch) {
          return exactMatch;
        }

        // Try to find close match (within 5g)
        const closeMatch = allPortions.find((p) => Math.abs(p.gramWeight - servingSizeGrams) <= 5);
        if (closeMatch) {
          return closeMatch;
        }

        // Check user preference for metric or imperial and use proper units
        const portionName = generatePortionName(servingSizeGrams, units);

        const newPortion = await FoodPortionService.createFoodPortion(
          portionName,
          servingSizeGrams,
          undefined, // icon
          false // isDefault
        );

        return newPortion;
      } catch (error) {
        console.warn('Error matching serving size to portion:', error);
        return null;
      }
    },
    [generatePortionName, units]
  );

  const getDefaultServingSize = useCallback(async () => {
    const servingStr =
      productFromSearch?.serving_size ??
      (isSuccessFoodDetailProductState(productDetails)
        ? productDetails.product.serving_size
        : null);

    let servingSizeGrams = 100; // Default

    // Parse serving size from string
    if (servingStr) {
      const match = String(servingStr).match(/\((\d+)\s*g\)/);
      if (match) {
        const g = parseInt(match[1], 10);
        if (g > 0) {
          servingSizeGrams = g;
        }
      } else {
        const num = String(servingStr).match(/(\d+)/);
        if (num) {
          const g = parseInt(num[1], 10);
          if (g > 0) {
            servingSizeGrams = g;
          }
        }
      }
    }

    // Match serving size to existing portions and store the result
    if (!food && !localFood && (productFromSearch || productDetails)) {
      const portion = await matchServingSizeToPortion(servingSizeGrams);
      setMatchedPortion(portion);
    }

    return servingSizeGrams;
  }, [productDetails, productFromSearch, food, localFood, matchServingSizeToPortion]);

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
      setServingSize(initialServingSize || 100);
      return;
    }

    if (localFood) {
      // Local food found by barcode lookup, show details
      setIsFoodDetailsModalVisible(true);
      setServingSize(initialServingSize || 100);
      setIsFavorite(localFood.isFavorite);
      return;
    }

    const nutriments = productFromSearch ? getNutrimentsWithFallback(productFromSearch) : null;
    const isUSDASearchResult = productFromSearch?.source === 'usda';

    // Use preloaded search result (no network fetch) – fixes Android modal not opening
    if (getProductName(productFromSearch) && (nutriments || isUSDASearchResult)) {
      setIsFoodDetailsModalVisible(true);
      const loadDefaultSize = async () => {
        const defaultG = await getDefaultServingSize();
        setServingSize(defaultG);
      };

      loadDefaultSize();
      onBarcodeLookupComplete?.();
      return;
    }

    if (productDetails) {
      if (productDetails?.status !== 'success' && !productFromSearch && !food && !meal) {
        setIsFoodNotFoundModalVisible(true);
      } else if (productDetails?.status === 'success') {
        setIsFoodDetailsModalVisible(true);
      }
      onBarcodeLookupComplete?.();
    }
  }, [
    productDetails,
    productFromSearch,
    food,
    localFood,
    meal,
    getDefaultServingSize,
    onBarcodeLookupComplete,
    initialServingSize,
  ]);

  // Load meal nutrients and total grams when meal is provided
  useEffect(() => {
    if (!meal) {
      setMealNutrients(null);
      setTotalMealGrams(0);
      setMealAmountGrams(0);
      return;
    }

    const loadMealNutrients = async () => {
      setIsLoadingMealNutrients(true);
      try {
        const [nutrients, mealWithFoods] = await Promise.all([
          meal.getTotalNutrients(),
          MealService.getMealWithFoods(meal.id),
        ]);
        setMealNutrients({
          calories: Math.round(nutrients.calories),
          protein: Math.round(nutrients.protein * 10) / 10,
          carbs: Math.round(nutrients.carbs * 10) / 10,
          fat: Math.round(nutrients.fat * 10) / 10,
          fiber: Math.round(nutrients.fiber * 10) / 10,
        });
        if (mealWithFoods?.foods) {
          let totalGrams = 0;
          for (const mf of mealWithFoods.foods) {
            totalGrams += await mf.getGramWeight();
          }
          const rounded = Math.round(totalGrams);
          setTotalMealGrams(rounded);
          setMealAmountGrams(rounded > 0 ? rounded : 100);
        } else {
          setTotalMealGrams(0);
          setMealAmountGrams(100);
        }
      } catch (error) {
        console.error('Error loading meal nutrients:', error);
        setMealNutrients({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
        setTotalMealGrams(0);
        setMealAmountGrams(100);
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

    const doTask = async () => {
      try {
        const grams = await foodLog.getGramWeight();
        if (!cancelled && typeof grams === 'number' && !Number.isNaN(grams)) {
          setServingSize(Math.round(grams));
        }
      } catch (e) {
        // ignore
      }
    };

    doTask();

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
    if (food || localFood) {
      const foodData = food || localFood;
      return {
        calories: foodData!.calories || 0,
        protein: foodData!.protein || 0,
        carbs: foodData!.carbs || 0,
        fat: foodData!.fat || 0,
        fiber: foodData!.fiber || 0,
        sugar: foodData!.micros?.sugar || 0,
        saturatedFat: foodData!.micros?.saturatedFat || 0,
        sodium: foodData!.micros?.sodium || 0,
      };
    }

    if (isSuccessFoodDetailProductState(productDetails)) {
      const product = productDetails.product;

      if ((productDetails as any).source === 'usda') {
        const nutrients = (product as any).foodNutrients as any[];
        return {
          calories:
            mapUSDANutritient(nutrients, '1008') ??
            mapUSDANutritient(nutrients, '208') ??
            mapUSDANutritient(nutrients, 'ENERC_KCAL') ??
            0,
          protein: mapUSDANutritient(nutrients, '1003') ?? mapUSDANutritient(nutrients, '203') ?? 0,
          carbs: mapUSDANutritient(nutrients, '1005') ?? mapUSDANutritient(nutrients, '205') ?? 0,
          fat: mapUSDANutritient(nutrients, '1004') ?? mapUSDANutritient(nutrients, '204') ?? 0,
          fiber: mapUSDANutritient(nutrients, '1079') ?? mapUSDANutritient(nutrients, '291') ?? 0,
          sugar:
            mapUSDANutritient(nutrients, '2000') ??
            mapUSDANutritient(nutrients, '269') ??
            mapUSDANutritient(nutrients, 'sugars') ??
            0,
          saturatedFat:
            mapUSDANutritient(nutrients, '1258') ?? mapUSDANutritient(nutrients, '606') ?? 0,
          sodium: mapUSDANutritient(nutrients, '1093') ?? mapUSDANutritient(nutrients, '307') ?? 0,
        };
      }

      const nutrients = getNutrimentsWithFallback(product) || getNutrimentsFromV3Nutrition(product);
      if (!nutrients) {
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
      }

      // Map OFF nutriment keys (aligned with NUTRIMENT_PROPERTIES) to display values via getNutrimentValue
      const offKeys = {
        calories: 'energy-kcal',
        protein: 'proteins',
        carbs: 'carbohydrates',
        fat: 'fat',
        sugar: 'sugars',
        saturatedFat: 'saturated-fat',
      } as const;
      const getNum = (key: keyof typeof offKeys) =>
        (getNutrimentValue(nutrients, offKeys[key]) ?? 0) as number;
      const fiberRaw =
        (getNutrimentValue(nutrients, 'carbohydrates-total') ?? 0) -
        (getNutrimentValue(nutrients, 'carbohydrates') ?? 0);
      const sodium =
        getNutrimentValue(nutrients, 'sodium') ?? getNutrimentValue(nutrients, 'salt') ?? 0;

      return {
        calories: getNum('calories'),
        protein: getNum('protein'),
        carbs: getNum('carbs'),
        fat: getNum('fat'),
        fiber: (Number.isFinite(fiberRaw) ? fiberRaw : 0) || 0,
        sugar: getNum('sugar'),
        saturatedFat: getNum('saturatedFat'),
        sodium: Number.isFinite(sodium) ? sodium : 0,
      };
    }

    if (productFromSearch && productFromSearch.source === 'usda') {
      const mappedProduct = mapUSDAFoodToUnified(productFromSearch as any);
      const nutrients = (productFromSearch as any).foodNutrients as any[];

      return {
        calories: mappedProduct.calories ?? 0,
        protein: mappedProduct.protein ?? 0,
        carbs: mappedProduct.carbs ?? 0,
        fat: mappedProduct.fat ?? 0,
        fiber: mappedProduct.fiber ?? 0,
        sugar:
          mapUSDANutritient(nutrients, '2000') ??
          mapUSDANutritient(nutrients, '269') ??
          mapUSDANutritient(nutrients, 'sugars') ??
          0,
        saturatedFat:
          mapUSDANutritient(nutrients, '1258') ?? mapUSDANutritient(nutrients, '606') ?? 0,
        sodium: mapUSDANutritient(nutrients, '1093') ?? mapUSDANutritient(nutrients, '307') ?? 0,
      };
    }

    if (productFromSearch && productFromSearch.source === 'openfood') {
      const mappedProduct = mapOpenFoodFactsProduct(productFromSearch);
      const nut = mappedProduct.nutriments;
      let sugar = 0,
        saturatedFat = 0,
        sodium = 0;
      if (isMappedNutriments(nut)) {
        sugar = nut.macronutrients?.sugars ?? 0;
        saturatedFat = nut.macronutrients?.saturatedFat ?? 0;
        sodium = nut.minerals?.sodium ?? nut.other?.salt ?? 0;
      }

      return {
        calories: mappedProduct.calories || 0,
        protein: mappedProduct.protein || 0,
        carbs: mappedProduct.carbs || 0,
        fat: mappedProduct.fat || 0,
        fiber: mappedProduct.fiber || 0,
        sugar,
        saturatedFat,
        sodium,
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
  }, [
    productDetails,
    productFromSearch,
    food,
    localFood,
    foodLog,
    foodLogDecrypted,
    meal,
    mealNutrients,
  ]);

  const baseNutritionalData = getNutritionalData();
  const nutritionalData =
    editedOverrides &&
    (editedOverrides.calories != null ||
      editedOverrides.protein != null ||
      editedOverrides.carbs != null ||
      editedOverrides.fat != null)
      ? {
          ...baseNutritionalData,
          calories: editedOverrides.calories ?? baseNutritionalData.calories,
          protein: editedOverrides.protein ?? baseNutritionalData.protein,
          carbs: editedOverrides.carbs ?? baseNutritionalData.carbs,
          fat: editedOverrides.fat ?? baseNutritionalData.fat,
        }
      : baseNutritionalData;

  // Get product name from meal, barcode lookup, search result, local food, or log snapshot
  const getFoodMealName = useCallback(() => {
    if (editedOverrides?.name != null && editedOverrides.name.trim() !== '') {
      return editedOverrides.name.trim();
    }
    if (meal) {
      return meal.name || t('meals.history.unknownMeal');
    }

    if (food || localFood) {
      const foodData = food || localFood;
      return foodData!.name || t('food.unknownFood');
    }

    if (foodLogDecrypted?.loggedFoodName?.trim()) {
      return foodLogDecrypted.loggedFoodName.trim();
    }

    // Barcode lookup (V3 API): pass inner product so getProductName reads product_name_en etc. directly
    if (isSuccessFoodDetailProductState(productDetails)) {
      if ((productDetails as any).source === 'usda') {
        return (productDetails.product as any).description;
      }
      return getProductName(productDetails.product);
    }

    if (productFromSearch) {
      if ((productFromSearch as any).description && (productFromSearch as any).fdcId) {
        return (productFromSearch as any).description;
      }
      return getProductName(productFromSearch);
    }

    return t('food.unknownFood');
  }, [
    editedOverrides?.name,
    productDetails,
    productFromSearch,
    food,
    localFood,
    foodLogDecrypted,
    meal,
    t,
  ]);

  // Get product category/brand from meal, barcode lookup, search result, or local food
  const getProductCategory = useCallback(() => {
    if (meal) {
      return meal.description || t('meals.customMeal');
    }

    if (food || localFood) {
      const foodData = food || localFood;
      return foodData!.brand || '';
    }

    if (foodLog && !food) {
      return '';
    }

    if (productFromSearch) {
      if (productFromSearch.source === 'usda') {
        const brand = productFromSearch.brandOwner || productFromSearch.brandName;
        const category = productFromSearch.foodCategory;
        if (brand && category) {
          return `${brand} • ${category}`;
        }
        return brand || category || '';
      }
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
      const product = productDetails.product;
      if ((productDetails as any).source === 'usda') {
        const usdaBrand = (product as any).brandOwner || (product as any).brandName;
        const usdaCategory = (product as any).foodCategory;
        if (usdaBrand && usdaCategory) {
          return `${usdaBrand} • ${usdaCategory}`;
        }
        return usdaBrand || usdaCategory || '';
      }
      const brand = product.brands;
      const categories = product.categories;

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
  }, [productDetails, productFromSearch, food, localFood, foodLog, meal, t]);

  // Update serving size when product details or search product load
  useEffect(() => {
    if (productFromSearch || productDetails) {
      const loadDefaultSize = async () => {
        const defaultSize = await getDefaultServingSize();
        setServingSize(defaultSize);
      };

      loadDefaultSize();
    }
  }, [productFromSearch, productDetails, getDefaultServingSize]);

  // For meals: scale factor = (amount to log in g) / (total meal weight in g). Min 1g to avoid zero.
  const effectiveMealAmountGrams = Math.max(1, mealAmountGrams);
  const mealScaleFactor =
    meal && totalMealGrams > 0 ? effectiveMealAmountGrams / totalMealGrams : mealPortionMultiplier;

  // Calculate nutritional values based on serving size (for foods) or use meal nutrients directly
  const getScaledNutrition = useCallback(() => {
    // For meals, scale nutrients by amount in grams (mealScaleFactor)
    if (meal && mealNutrients) {
      return {
        name: getFoodMealName(),
        category: getProductCategory(),
        calories: Math.round(mealNutrients.calories * mealScaleFactor),
        protein: Math.round(mealNutrients.protein * mealScaleFactor * 10) / 10,
        carbs: Math.round(mealNutrients.carbs * mealScaleFactor * 10) / 10,
        fat: Math.round(mealNutrients.fat * mealScaleFactor * 10) / 10,
      };
    }

    // For foods, scale by serving size
    const scaleFactor = servingSize / 100; // API data is per 100g
    return {
      name: getFoodMealName(),
      category: getProductCategory(),
      calories: Math.round(nutritionalData.calories * scaleFactor),
      protein: Math.round(nutritionalData.protein * scaleFactor * 10) / 10,
      carbs: Math.round(nutritionalData.carbs * scaleFactor * 10) / 10,
      fat: Math.round(nutritionalData.fat * scaleFactor * 10) / 10,
    };
  }, [
    getProductCategory,
    getFoodMealName,
    meal,
    mealNutrients,
    mealScaleFactor,
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
    { id: 'other', label: t('food.meals.other') },
  ];

  const handleAddFood = useCallback(async () => {
    setIsAddingFood(true);
    // Small delay to allow React to render the loading state before closing
    await new Promise((resolve) => setTimeout(resolve, 1));

    try {
      // Handle meal logging
      if (meal) {
        try {
          // Get meal with its foods
          const mealWithFoods = await MealService.getMealWithFoods(meal.id);

          if (!mealWithFoods) {
            throw new Error('Failed to get meal foods');
          }

          // Log each food in the meal, scaled by (amount in g / total meal g)
          for (const mealFood of mealWithFoods.foods) {
            await NutritionService.logFood(
              mealFood.foodId,
              selectedDate,
              selectedMeal,
              mealFood.amount * mealScaleFactor,
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
          onFoodTracked?.();

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
          // Convert selectedDate to midnight timestamp for database storage
          const dateTimestamp = Date.UTC(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            0,
            0,
            0,
            0
          );

          await Promise.all([
            // Update amount in grams (set portion to undefined so amount is grams)
            foodLog.updateAmount(servingSize),
            foodLog.updateMealType(selectedMeal),
            foodLog.updatePortion(undefined),
            foodLog.updateDate(dateTimestamp),
          ]);

          // Call callback if provided
          onAddFood?.({ servingSize, meal: selectedMeal, date: selectedDate });

          onClose();
          onFoodTracked?.();

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
      if (food || localFood) {
        const foodData = food || localFood;
        // Create nutrition log with local food
        const logFoodPromise = NutritionService.logFood(
          foodData!.id,
          selectedDate,
          selectedMeal,
          servingSize
        );
        let foodUpdatePromise = null;

        // Update favorite status if needed
        if (isFavorite && !foodData!.isFavorite) {
          foodUpdatePromise = foodData!.update((record: any) => {
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
        onFoodTracked?.();

        showSnackbar('success', t('food.foodDetails.successMessage'), {
          action: t('snackbar.ok'),
        });
        return;
      }

      // Handle API food: prefer barcode-fetched details over search results to get micros
      let productToSave: any =
        (isSuccessFoodDetailProductState(productDetails) ? productDetails.product : null) ??
        productFromSearch;
      if (!productToSave) {
        throw new Error('Product details not loaded');
      }

      // Apply user edits (e.g. from AI-sourced data) to name and barcode
      if (editedOverrides) {
        if (productToSave.fdcId) {
          productToSave = {
            ...productToSave,
            description: editedOverrides.name?.trim() || productToSave.description,
            gtinUpc: editedOverrides.barcode?.trim() || productToSave.gtinUpc,
          };
        } else {
          const codeFromProduct = (productToSave as { code?: string }).code;
          productToSave = {
            ...productToSave,
            product_name:
              (editedOverrides.name?.trim() || getProductName(productToSave)).trim() ||
              getProductName(productToSave),
            code: (editedOverrides.barcode?.trim() || codeFromProduct) ?? '',
          } as typeof productToSave;
        }
      }

      // USDA handle
      if (productToSave.fdcId) {
        const newFood = await FoodService.createFromUSDAProduct(
          productToSave,
          {
            calories: nutritionalData.calories,
            protein: nutritionalData.protein,
            carbs: nutritionalData.carbs,
            fat: nutritionalData.fat,
            fiber: nutritionalData.fiber,
            sugar: nutritionalData.sugar,
            saturatedFat: nutritionalData.saturatedFat,
            sodium: nutritionalData.sodium,
            micros:
              productDetails && (productDetails as any)?.product?.foodNutrients
                ? ((productDetails as any).product as any).foodNutrients.reduce(
                    (acc: any, n: any) => {
                      const num = n.nutrientNumber || n.number || n.nutrient?.number;
                      if (num) {
                        acc[num] = n.value ?? n.amount;
                      }
                      return acc;
                    },
                    {}
                  )
                : undefined,
            isFavorite: isFavorite,
          },
          matchedPortion
        );

        // Create nutrition log
        const logFoodPromise = NutritionService.logFood(
          newFood.id,
          selectedDate,
          selectedMeal as MealType,
          servingSize
        );

        await Promise.all([logFoodPromise, new Promise((resolve) => setTimeout(resolve, 100))]);

        onAddFood?.({
          servingSize,
          meal: selectedMeal,
          date: selectedDate,
        });

        onClose();
        onFoodTracked?.();

        showSnackbar('success', t('food.foodDetails.successMessage'), {
          action: t('snackbar.ok'),
        });
        return;
      }

      // Save product to local database (search result has same shape as V3 for our usage)
      const newFood = await FoodService.createFromV3Product(
        productToSave,
        {
          calories: nutritionalData.calories,
          protein: nutritionalData.protein,
          carbs: nutritionalData.carbs,
          fat: nutritionalData.fat,
          fiber: nutritionalData.fiber,
          sugar: nutritionalData.sugar,
          saturatedFat: nutritionalData.saturatedFat,
          sodium: nutritionalData.sodium,
          micros:
            productDetails && (productDetails as any)?.product?.nutriments
              ? ((productDetails as any).product as any).nutriments
              : undefined,
          isFavorite: isFavorite,
        },
        matchedPortion
      );

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
      onFoodTracked?.();

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
    localFood,
    productFromSearch,
    productDetails,
    editedOverrides,
    nutritionalData.calories,
    nutritionalData.protein,
    nutritionalData.carbs,
    nutritionalData.fat,
    nutritionalData.fiber,
    nutritionalData.sugar,
    nutritionalData.saturatedFat,
    nutritionalData.sodium,
    isFavorite,
    matchedPortion,
    selectedDate,
    selectedMeal,
    servingSize,
    onAddFood,
    onClose,
    onFoodTracked,
    showSnackbar,
    t,
    onLogMeal,
    mealScaleFactor,
  ]);

  const handleOpenEditPopUp = useCallback(() => {
    const productCode =
      (productFromSearch && 'code' in productFromSearch
        ? (productFromSearch as { code?: string }).code
        : undefined) ?? '';
    setEditForm({
      name: getFoodMealName(),
      barcode: barcode ?? productCode ?? '',
      calories: String(baseNutritionalData.calories),
      protein: String(baseNutritionalData.protein),
      carbs: String(baseNutritionalData.carbs),
      fat: String(baseNutritionalData.fat),
    });
    setIsEditPopUpVisible(true);
  }, [
    getFoodMealName,
    baseNutritionalData.calories,
    baseNutritionalData.protein,
    baseNutritionalData.carbs,
    baseNutritionalData.fat,
    barcode,
    productFromSearch,
  ]);

  const handleSaveEditPopUp = useCallback(() => {
    if (!editForm) {
      return;
    }
    const cal = Number(editForm.calories);
    const pro = Number(editForm.protein);
    const carb = Number(editForm.carbs);
    const f = Number(editForm.fat);
    setEditedOverrides({
      name: editForm.name.trim() || undefined,
      barcode: editForm.barcode.trim() || undefined,
      calories: Number.isFinite(cal) ? cal : undefined,
      protein: Number.isFinite(pro) ? pro : undefined,
      carbs: Number.isFinite(carb) ? carb : undefined,
      fat: Number.isFinite(f) ? f : undefined,
    });
    setEditForm(null);
    setIsEditPopUpVisible(false);
  }, [editForm]);

  const handleEditFormNumericChange = useCallback(
    (field: 'calories' | 'protein' | 'carbs' | 'fat') => (value: string) => {
      const numericValue = value.replace(/[^0-9.]/g, '');
      setEditForm((prev) => (prev ? { ...prev, [field]: numericValue } : null));
    },
    []
  );

  // Handlers for FoodNotFoundModal actions — close Food Details modal too so parent can resume camera.
  const handleTryAiScan = useCallback(() => {
    setIsFoodNotFoundModalVisible(false);
    onClose();
    // Trigger AI scan logic
  }, [onClose]);

  const handleSearchAgain = useCallback(() => {
    setIsFoodNotFoundModalVisible(false);
    onClose();
    // Trigger search again logic
  }, [onClose]);

  const handleCreateCustom = useCallback(() => {
    setIsFoodNotFoundModalVisible(false);
    onClose();
    // Trigger create custom food logic
  }, [onClose]);

  const handleFoodNotFoundClose = useCallback(() => {
    setIsFoodNotFoundModalVisible(false);
    onClose();
  }, [onClose]);

  // Reset matched portion and edit overrides when modal closes
  useEffect(() => {
    if (!visible) {
      setMatchedPortion(null);
      setEditedOverrides(null);
      setIsEditPopUpVisible(false);
      setShowBarcodeScannerInEdit(false);
    }
  }, [visible]);

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
        isAiEnabled={isAiEnabled}
      />
    );
  }

  // Helper function to determine action label based on mode
  const getActionLabel = (): string => {
    if (meal) {
      return t('meals.logMeal');
    }

    if (foodLog) {
      return t('food.foodDetails.updateFood');
    }

    return t('food.foodDetails.addFood');
  };

  const actionLabel = getActionLabel();

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
              icon={foodLog ? RefreshCcwDot : PlusCircle}
              variant="gradientCta"
              size="sm"
              width="full"
              onPress={handleAddFood}
              disabled={
                isAddingFood ||
                (mode === 'meal' && mealAmountGrams < 1) ||
                (isLoadingDetails && mode !== 'meal' && mode !== 'food' && mode !== 'foodLog')
              }
              loading={isAddingFood}
            />
          </View>
        }
      >
        <View className="flex-1 px-4 pb-6">
          {/* Food Info Card */}
          <View className="mt-6">
            <View className="relative">
              <FoodInfoCard food={scaledFood} />
              {canEdit && mode !== 'meal' ? (
                <Pressable
                  onPress={handleOpenEditPopUp}
                  className="absolute bottom-3 right-3 z-10 h-9 w-9 items-center justify-center rounded-full bg-bg-overlay"
                  style={{
                    elevation: 2,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 2,
                  }}
                >
                  <Edit3 size={theme.iconSize.sm} color={theme.colors.text.secondary} />
                </Pressable>
              ) : null}
            </View>

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
                  {isLoadingDetails ? (
                    <View className="mt-2 flex-row items-center justify-center gap-2">
                      <ActivityIndicator size="small" color={theme.colors.accent.primary} />
                      <Text className="text-xs text-text-secondary">
                        {t('food.foodDetails.loadingMoreDetails', 'Loading more details...')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : isLoadingDetails && mode !== 'meal' && mode !== 'food' && mode !== 'foodLog' ? (
              <View className="mt-4 rounded-2xl border border-border-light bg-bg-overlay p-4">
                <View className="flex-row items-center justify-center gap-2">
                  <ActivityIndicator size="small" color={theme.colors.accent.primary} />
                  <Text className="text-xs text-text-secondary">
                    {t('food.foodDetails.loadingDetails', 'Loading details...')}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Form Sections */}
          <View className="gap-6">
            {/* Same serving size input for both food and meal (editable, same UX) */}
            {mode !== 'meal' ? (
              <ServingSizeSelector value={servingSize} onChange={setServingSize} />
            ) : (
              <ServingSizeSelector
                value={mealAmountGrams}
                onChange={(v) => setMealAmountGrams(Math.round(v))}
                quickSizes={
                  totalMealGrams > 0
                    ? [
                        { label: '½×', value: Math.round(totalMealGrams * 0.5) },
                        { label: '1×', value: totalMealGrams },
                        { label: '1½×', value: Math.round(totalMealGrams * 1.5) },
                        { label: '2×', value: totalMealGrams * 2 },
                      ]
                    : []
                }
              />
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

      {/* Edit food info (AI-sourced data) */}
      <BottomPopUp
        visible={isEditPopUpVisible ? editForm !== null : false}
        onClose={() => {
          setIsEditPopUpVisible(false);
          setEditForm(null);
        }}
        title={t('food.foodDetails.editFoodInfo')}
        subtitle={t('food.foodDetails.editFoodInfoSubtitle')}
        headerIcon={
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.status.purple20 }}
          >
            <Edit3 size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </View>
        }
        footer={
          <Button
            label={t('common.save', 'Save')}
            variant="gradientCta"
            size="sm"
            width="full"
            onPress={handleSaveEditPopUp}
          />
        }
      >
        {editForm ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="gap-5"
          >
            {/* Food Name - same style as CreateCustomFoodModal */}
            <TextInput
              label={t('food.foodDetails.foodName')}
              value={editForm.name}
              onChangeText={(text) =>
                setEditForm((prev) => (prev ? { ...prev, name: text } : null))
              }
              placeholder={t('food.foodDetails.foodNamePlaceholder')}
              icon={<Pencil size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
            />

            {/* Barcode - same layout as CreateCustomFoodModal with scan icon */}
            <View className="relative">
              <TextInput
                label={t('food.foodDetails.barcode')}
                value={editForm.barcode}
                onChangeText={(text) =>
                  setEditForm((prev) => (prev ? { ...prev, barcode: text } : null))
                }
                placeholder={t('food.foodDetails.barcodePlaceholder')}
                keyboardType="numeric"
              />
              <Pressable
                className="absolute right-2 items-center justify-center rounded-lg"
                style={{
                  ...(Platform.OS !== 'web'
                    ? { top: theme.size['14'] / 2 }
                    : { top: theme.size['18'] / 2 }),
                  width: theme.size['10'],
                  height: theme.size['10'],
                  backgroundColor: theme.colors.accent.primary10,
                }}
                onPress={() => setShowBarcodeScannerInEdit(true)}
              >
                <ScanLine size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </Pressable>
            </View>

            {/* Macronutrients - card layout like CreateCustomFoodModal */}
            <View className="flex-row items-center gap-2">
              <BarChart size={theme.iconSize.lg} color={theme.colors.accent.primary} />
              <Text className="text-xl font-bold text-text-primary">
                {t('food.newCustomFood.macronutrients')}
              </Text>
            </View>

            <Text className="text-xs font-bold uppercase tracking-widest text-text-secondary">
              {t('food.foodDetails.macrosPer100g')}
            </Text>

            <MacroInput
              label={t('food.newCustomFood.calories')}
              value={editForm.calories}
              onChange={handleEditFormNumericChange('calories')}
              topRightElement={
                <View
                  className="rounded-full px-2"
                  style={{
                    paddingVertical: theme.spacing.padding.xsHalf,
                    backgroundColor: theme.colors.accent.primary10,
                  }}
                >
                  <Text className="text-xs font-medium text-accent-primary">
                    {t('food.common.kcal')}
                  </Text>
                </View>
              }
              variant="default"
              size="full"
            />

            <View className="flex-row flex-wrap gap-4">
              <MacroInput
                label={t('food.newCustomFood.protein')}
                value={editForm.protein}
                onChange={handleEditFormNumericChange('protein')}
                topRightElement={
                  <Dumbbell size={theme.iconSize.sm} color={theme.colors.status.emeraldLight} />
                }
                variant="success"
                size="half"
              />
              <MacroInput
                label={t('food.newCustomFood.carbs')}
                value={editForm.carbs}
                onChange={handleEditFormNumericChange('carbs')}
                topRightElement={
                  <Cookie size={theme.iconSize.sm} color={theme.colors.status.amber} />
                }
                variant="warning"
                size="half"
              />
              <MacroInput
                label={t('food.newCustomFood.fat')}
                value={editForm.fat}
                onChange={handleEditFormNumericChange('fat')}
                topRightElement={
                  <Droplet size={theme.iconSize.sm} color={theme.colors.status.red400} />
                }
                variant="error"
                size="half"
              />
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </BottomPopUp>

      <BarcodeCameraModal
        visible={showBarcodeScannerInEdit}
        onClose={() => setShowBarcodeScannerInEdit(false)}
        onBarcodeScanned={(data) => {
          setEditForm((prev) => (prev ? { ...prev, barcode: data } : null));
          setShowBarcodeScannerInEdit(false);
        }}
      />
    </>
  );
}
