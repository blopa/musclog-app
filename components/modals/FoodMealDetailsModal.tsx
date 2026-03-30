import {
  AlignLeft,
  BarChart,
  BookmarkPlus,
  Cookie,
  Droplet,
  Dumbbell,
  Edit3,
  Pencil,
  PlusCircle,
  RefreshCcwDot,
  ScanLine,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import type { Units } from '../../constants/settings';
import { useSnackbar } from '../../context/SnackbarContext';
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
import {
  fetchMusclogProductByBarcode,
  fetchOFFProductByBarcode,
  fetchUSDAProductByBarcode,
  type ProductDetailsQueryData,
  useFoodProductDetails,
} from '../../hooks/useFoodProductDetails';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import {
  isMappedNutriments,
  isSuccessFoodDetailProductState,
  isSuccessStatus,
} from '../../types/guards/openFoodFacts';
import { localCalendarDayDate, localDayStartMs } from '../../utils/calendarDate';
import { formatAppRoundedDecimal } from '../../utils/formatAppNumber';
import {
  getDecimalSeparator,
  parseLocalizedDecimalString,
  sanitizeLocalizedDecimalInput,
} from '../../utils/localizedDecimalInput';
import {
  getNutrimentsFromV3Nutrition,
  getNutrimentsWithFallback,
  getNutrimentValue,
  mapOpenFoodFactsProduct,
} from '../../utils/openFoodFactsMapper';
import { getProductName } from '../../utils/productName';
import { roundToDecimalPlaces } from '../../utils/roundDecimal';
import { captureException } from '../../utils/sentry';
import { getMassUnitLabel, gramsToDisplay } from '../../utils/unitConversion';
import { mapUSDAFoodToUnified, mapUSDANutritient } from '../../utils/usdaMapper';
import { BottomPopUp } from '../BottomPopUp';
import { FoodNutritionSectionCard } from '../cards/FoodNutritionSectionCard';
import { FilterTabs } from '../FilterTabs';
import { MacroInput } from '../MacroInput';
import { ServingSizeSelector } from '../ServingSizeSelector';
import { Button } from '../theme/Button';
import { TextInput } from '../theme/TextInput';
import { BarcodeCameraModal } from './BarcodeCameraModal';
import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FoodNotFoundModal } from './FoodNotFoundModal';
import { FullScreenModal } from './FullScreenModal';

/** Coerce API / DB values that may be strings (e.g. "0") into finite numbers for macro comparisons. */
function toFiniteMacro(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function areCoreMacrosEffectivelyZero(data: {
  calories?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
}): boolean {
  const eps = 1e-6;
  return (
    Math.abs(toFiniteMacro(data.calories)) < eps &&
    Math.abs(toFiniteMacro(data.protein)) < eps &&
    Math.abs(toFiniteMacro(data.carbs)) < eps &&
    Math.abs(toFiniteMacro(data.fat)) < eps
  );
}

/**
 * OFF barcode responses from `useFoodProductDetails` omit `source`; treat that as Open Food Facts
 * so we do not redundantly refetch OFF when trying alternate providers.
 */
function inferBarcodeNutritionSource(
  details: ProductDetailsQueryData | null | undefined,
  productFromSearch: any
): 'openfood' | 'usda' | 'musclog' | null {
  const explicit = (details as any)?.source ?? productFromSearch?.source;
  if (explicit === 'usda') {
    return 'usda';
  }
  if (explicit === 'musclog') {
    return 'musclog';
  }
  if (explicit === 'openfood') {
    return 'openfood';
  }
  if (details && isSuccessFoodDetailProductState(details)) {
    return 'openfood';
  }
  if (productFromSearch?.source === 'openfood') {
    return 'openfood';
  }
  return null;
}

/** Per-100g core macros from a successful product-details payload (used to pick a non-empty alternate source). */
function parseCoreMacrosFromAlternateSource(state: ProductDetailsQueryData): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} | null {
  if (!isSuccessFoodDetailProductState(state)) {
    return null;
  }
  const product = state.product;
  const src = (state as any).source;

  if (src === 'musclog') {
    const p = product as any;
    return {
      calories: toFiniteMacro(parseFloat(p.kcal ?? p.calories ?? 0)),
      protein: toFiniteMacro(parseFloat(p.protein ?? 0)),
      carbs: toFiniteMacro(parseFloat(p.carbs ?? 0)),
      fat: toFiniteMacro(parseFloat(p.fat ?? 0)),
    };
  }

  if (src === 'usda') {
    const nutrients = (product as any).foodNutrients as any[];
    const rawServingSize = (product as any).servingSize;
    const isBranded = (product as any).dataType === 'Branded';
    const normFactor = isBranded && rawServingSize && rawServingSize > 0 ? 100 / rawServingSize : 1;
    return {
      calories: toFiniteMacro(
        (mapUSDANutritient(nutrients, '1008') ??
          mapUSDANutritient(nutrients, '208') ??
          mapUSDANutritient(nutrients, 'ENERC_KCAL') ??
          0) * normFactor
      ),
      protein: toFiniteMacro(
        (mapUSDANutritient(nutrients, '1003') ?? mapUSDANutritient(nutrients, '203') ?? 0) *
          normFactor
      ),
      carbs: toFiniteMacro(
        (mapUSDANutritient(nutrients, '1005') ?? mapUSDANutritient(nutrients, '205') ?? 0) *
          normFactor
      ),
      fat: toFiniteMacro(
        (mapUSDANutritient(nutrients, '1004') ?? mapUSDANutritient(nutrients, '204') ?? 0) *
          normFactor
      ),
    };
  }

  const nutrients = getNutrimentsWithFallback(product) || getNutrimentsFromV3Nutrition(product);
  if (!nutrients) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  const offKeys = {
    calories: 'energy-kcal',
    protein: 'proteins',
    carbs: 'carbohydrates',
    fat: 'fat',
  } as const;
  const getNum = (key: keyof typeof offKeys) =>
    toFiniteMacro((getNutrimentValue(nutrients, offKeys[key]) ?? 0) as number);
  return {
    calories: getNum('calories'),
    protein: getNum('protein'),
    carbs: getNum('carbs'),
    fat: getNum('fat'),
  };
}

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
  const { t, i18n } = useTranslation();
  const locale = useMemo(
    () => i18n.resolvedLanguage ?? i18n.language,
    [i18n.resolvedLanguage, i18n.language]
  );
  const decimalSeparator = useMemo(() => getDecimalSeparator(locale), [locale]);
  const { showSnackbar } = useSnackbar();
  const { units } = useSettings();
  const scrollViewRef = useRef<ScrollView>(null);

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
  /** User edits to AI-sourced product (name, barcode, description, per-100g macros). */
  const [editedOverrides, setEditedOverrides] = useState<{
    name?: string;
    barcode?: string;
    description?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  } | null>(null);
  const [isEditPopUpVisible, setIsEditPopUpVisible] = useState(false);
  const [showBarcodeScannerInEdit, setShowBarcodeScannerInEdit] = useState(false);
  /** Holds product data fetched from an alternate source when the primary source had zero macros. */
  const [refetchedProductDetails, setRefetchedProductDetails] =
    useState<ProductDetailsQueryData | null>(null);
  /** True while the "try another source" cross-provider fetch is in flight. */
  const [isRefetchingSource, setIsRefetchingSource] = useState(false);
  /** Local override for canEdit — allows the modal to programmatically enable editing. */
  const [localCanEdit, setLocalCanEdit] = useState(canEdit);
  /** After "try another source" runs and no provider returns usable macros — show edit-only banner, hide retry. */
  const [alternateSourceLookupFailed, setAlternateSourceLookupFailed] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    barcode: string;
    description: string;
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

  // Sync localCanEdit when the canEdit prop changes.
  useEffect(() => {
    setLocalCanEdit(canEdit);
  }, [canEdit]);

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
    barcode &&
    !food &&
    !meal &&
    !productFromSearch &&
    (!localFood || !localFood.name?.trim()) &&
    hasCheckedLocalFood
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

  const hasNoNutrition = useMemo(() => {
    const isOpenfoodSource =
      productFromSearch?.source === 'openfood' ||
      (isSuccessFoodDetailProductState(productDetails) &&
        (productDetails as any).source !== 'usda' &&
        (productDetails as any).source !== 'musclog');

    if (!isOpenfoodSource) {
      return false;
    }

    const product = isSuccessFoodDetailProductState(productDetails)
      ? productDetails.product
      : productFromSearch;

    if (!product) {
      return false;
    }

    return (
      product.no_nutrition_data === 'on' ||
      product.no_nutrition_data === 1 ||
      !product.nutriments ||
      Object.keys(product.nutriments).length === 0
    );
  }, [productFromSearch, productDetails]);

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
    // USDA data uses camelCase `servingSize`, while OpenFoodFacts uses snake_case `serving_size`
    const usdaServingSizeStr =
      productFromSearch?.servingSize != null
        ? `${productFromSearch.servingSize}${productFromSearch.servingSizeUnit || 'g'}`
        : null;

    const productDetailsServingStr = isSuccessFoodDetailProductState(productDetails)
      ? (productDetails.product.serving_size ??
        ((productDetails as any).source === 'usda' &&
        (productDetails.product as any).servingSize != null
          ? `${(productDetails.product as any).servingSize}${(productDetails.product as any).servingSizeUnit || 'g'}`
          : null))
      : null;

    const servingStr =
      productFromSearch?.serving_size ?? usdaServingSizeStr ?? productDetailsServingStr;

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
    if (getProductName(productFromSearch).found && (nutriments || isUSDASearchResult)) {
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
      if (!isSuccessStatus(productDetails?.status) && !productFromSearch && !food && !meal) {
        setIsFoodNotFoundModalVisible(true);
      } else if (isSuccessStatus(productDetails?.status)) {
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
          calories: roundToDecimalPlaces(nutrients.calories),
          protein: roundToDecimalPlaces(nutrients.protein),
          carbs: roundToDecimalPlaces(nutrients.carbs),
          fat: roundToDecimalPlaces(nutrients.fat),
          fiber: roundToDecimalPlaces(nutrients.fiber),
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

    const effectiveProductDetails = refetchedProductDetails ?? productDetails;

    if (isSuccessFoodDetailProductState(effectiveProductDetails)) {
      const product = effectiveProductDetails.product;

      if ((effectiveProductDetails as any).source === 'musclog') {
        const p = product as any;
        return {
          calories: parseFloat(p.kcal ?? p.calories ?? 0) || 0,
          protein: parseFloat(p.protein ?? 0) || 0,
          carbs: parseFloat(p.carbs ?? 0) || 0,
          fat: parseFloat(p.fat ?? 0) || 0,
          fiber: parseFloat(p.fiber ?? 0) || 0,
          sugar: parseFloat(p.other_nutrients?.sugar ?? p.sugar ?? 0) || 0,
          saturatedFat: parseFloat(p.other_nutrients?.saturated_fat ?? p.saturatedFat ?? 0) || 0,
          sodium: parseFloat(p.other_nutrients?.sodium ?? p.sodium ?? 0) || 0,
        };
      }

      if ((effectiveProductDetails as any).source === 'usda') {
        const nutrients = (product as any).foodNutrients as any[];
        // USDA Branded foods report nutrients per serving, not per 100g. Normalize to per-100g
        // so that the modal's scaleFactor (servingSize / 100) produces correct values.
        const rawServingSize = (product as any).servingSize;
        const isBranded = (product as any).dataType === 'Branded';
        const normFactor =
          isBranded && rawServingSize && rawServingSize > 0 ? 100 / rawServingSize : 1;
        return {
          calories:
            (mapUSDANutritient(nutrients, '1008') ??
              mapUSDANutritient(nutrients, '208') ??
              mapUSDANutritient(nutrients, 'ENERC_KCAL') ??
              0) * normFactor,
          protein:
            (mapUSDANutritient(nutrients, '1003') ?? mapUSDANutritient(nutrients, '203') ?? 0) *
            normFactor,
          carbs:
            (mapUSDANutritient(nutrients, '1005') ?? mapUSDANutritient(nutrients, '205') ?? 0) *
            normFactor,
          fat:
            (mapUSDANutritient(nutrients, '1004') ?? mapUSDANutritient(nutrients, '204') ?? 0) *
            normFactor,
          fiber:
            (mapUSDANutritient(nutrients, '1079') ?? mapUSDANutritient(nutrients, '291') ?? 0) *
            normFactor,
          sugar:
            (mapUSDANutritient(nutrients, '2000') ??
              mapUSDANutritient(nutrients, '269') ??
              mapUSDANutritient(nutrients, 'sugars') ??
              0) * normFactor,
          saturatedFat:
            (mapUSDANutritient(nutrients, '1258') ?? mapUSDANutritient(nutrients, '606') ?? 0) *
            normFactor,
          sodium:
            (mapUSDANutritient(nutrients, '1093') ?? mapUSDANutritient(nutrients, '307') ?? 0) *
            normFactor,
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
      const directFiber = getNutrimentValue(nutrients, 'fiber');
      let fiber: number;
      if (directFiber !== undefined && directFiber >= 0) {
        fiber = directFiber;
      } else {
        const carbsTotal = getNutrimentValue(nutrients, 'carbohydrates-total');
        const carbs = getNutrimentValue(nutrients, 'carbohydrates');
        fiber =
          carbsTotal !== undefined && carbs !== undefined ? Math.max(0, carbsTotal - carbs) : 0;
      }
      const sodium =
        getNutrimentValue(nutrients, 'sodium') ?? getNutrimentValue(nutrients, 'salt') ?? 0;

      return {
        calories: getNum('calories'),
        protein: getNum('protein'),
        carbs: getNum('carbs'),
        fat: getNum('fat'),
        fiber,
        sugar: getNum('sugar'),
        saturatedFat: getNum('saturatedFat'),
        sodium: Number.isFinite(sodium) ? sodium : 0,
      };
    }

    if (productFromSearch && productFromSearch.source === 'usda') {
      const mappedProduct = mapUSDAFoodToUnified(productFromSearch as any);
      const nutrients = (productFromSearch as any).foodNutrients as any[];
      // USDA Branded foods report nutrients per serving, not per 100g. Normalize to per-100g
      // so that the modal's scaleFactor (servingSize / 100) produces correct values.
      const rawServingSize = (productFromSearch as any).servingSize;
      const isBranded = (productFromSearch as any).dataType === 'Branded';
      const normFactor =
        isBranded && rawServingSize && rawServingSize > 0 ? 100 / rawServingSize : 1;

      return {
        calories: (mappedProduct.calories ?? 0) * normFactor,
        protein: (mappedProduct.protein ?? 0) * normFactor,
        carbs: (mappedProduct.carbs ?? 0) * normFactor,
        fat: (mappedProduct.fat ?? 0) * normFactor,
        fiber: (mappedProduct.fiber ?? 0) * normFactor,
        sugar:
          (mapUSDANutritient(nutrients, '2000') ??
            mapUSDANutritient(nutrients, '269') ??
            mapUSDANutritient(nutrients, 'sugars') ??
            0) * normFactor,
        saturatedFat:
          (mapUSDANutritient(nutrients, '1258') ?? mapUSDANutritient(nutrients, '606') ?? 0) *
          normFactor,
        sodium:
          (mapUSDANutritient(nutrients, '1093') ?? mapUSDANutritient(nutrients, '307') ?? 0) *
          normFactor,
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

    // Fallback for AI-sourced products (no or unrecognized source) that carry nutriments directly
    if (productFromSearch) {
      const nutrients = getNutrimentsWithFallback(productFromSearch);
      if (nutrients) {
        const getNum = (key: string) => (getNutrimentValue(nutrients, key) ?? 0) as number;
        const directFiber = getNutrimentValue(nutrients, 'fiber');
        let fiber: number;

        if (directFiber !== undefined && directFiber >= 0) {
          fiber = directFiber;
        } else {
          const carbsTotal = getNutrimentValue(nutrients, 'carbohydrates-total');
          const carbs = getNutrimentValue(nutrients, 'carbohydrates');
          fiber =
            carbsTotal !== undefined && carbs !== undefined ? Math.max(0, carbsTotal - carbs) : 0;
        }

        const sodium =
          getNutrimentValue(nutrients, 'sodium') ?? getNutrimentValue(nutrients, 'salt') ?? 0;
        return {
          calories: getNum('energy-kcal') || getNum('kcal'),
          protein: getNum('proteins'),
          carbs: getNum('carbohydrates'),
          fat: getNum('fat'),
          fiber,
          sugar: getNum('sugars'),
          saturatedFat: getNum('saturated-fat'),
          sodium: Number.isFinite(sodium) ? sodium : 0,
        };
      }
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
    refetchedProductDetails,
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

  // True when we're in barcode mode, nutrition is settled, no successful refetch yet, and all core macros are zero
  const hasAllZeroMacros = useMemo(() => {
    if (mode !== 'barcode' || refetchedProductDetails) {
      return false;
    }
    // Wait until local DB lookup finishes so we don't use placeholder zeros before we know local vs remote data.
    if (barcode && !hasCheckedLocalFood) {
      return false;
    }
    // While the barcode product query is active, wait for it to finish (not the USDA-by-id path).
    if (barcodeForHook && isLoadingDetails) {
      return false;
    }
    if (!areCoreMacrosEffectivelyZero(baseNutritionalData)) {
      return false;
    }
    const hasProductPayload =
      !!food ||
      !!localFood ||
      !!productFromSearch ||
      isSuccessFoodDetailProductState(productDetails) ||
      isSuccessFoodDetailProductState(refetchedProductDetails);
    if (!hasProductPayload) {
      return false;
    }
    return true;
  }, [
    mode,
    refetchedProductDetails,
    barcode,
    hasCheckedLocalFood,
    barcodeForHook,
    isLoadingDetails,
    baseNutritionalData,
    food,
    localFood,
    productFromSearch,
    productDetails,
  ]);

  // Get product name from meal, barcode lookup, search result, local food, or log snapshot
  const getFoodMealName = useCallback(() => {
    if (editedOverrides?.name != null && editedOverrides.name.trim() !== '') {
      return editedOverrides.name.trim();
    }
    if (meal) {
      return meal.name || t('meals.history.unknownMeal');
    }

    if (food) {
      return food.name || t('food.unknownFood');
    }

    if (localFood?.name?.trim()) {
      return localFood.name;
    }

    if (foodLogDecrypted?.loggedFoodName?.trim()) {
      return foodLogDecrypted.loggedFoodName.trim();
    }

    const effectiveProductDetails = refetchedProductDetails ?? productDetails;
    if (isSuccessFoodDetailProductState(effectiveProductDetails)) {
      return getProductName(effectiveProductDetails).name;
    }

    if (productFromSearch) {
      return getProductName(productFromSearch).name;
    }

    return t('food.unknownFood');
  }, [
    editedOverrides?.name,
    productDetails,
    refetchedProductDetails,
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

    const effectiveProductDetails = refetchedProductDetails ?? productDetails;
    if (isSuccessFoodDetailProductState(effectiveProductDetails)) {
      const product = effectiveProductDetails.product;
      if ((effectiveProductDetails as any).source === 'musclog') {
        return (product as any).brand || '';
      }
      if ((effectiveProductDetails as any).source === 'usda') {
        const usdaBrand = (product as any).brandOwner || (product as any).brandName;
        const usdaCategory = (product as any).foodCategory;
        if (usdaBrand && usdaCategory) {
          return `${usdaBrand} • ${usdaCategory}`;
        }
        return usdaBrand || usdaCategory || '';
      }
      const product2 = effectiveProductDetails.product;
      const brand = product2.brands;
      const categories = product2.categories;

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
  }, [
    productDetails,
    refetchedProductDetails,
    productFromSearch,
    food,
    localFood,
    foodLog,
    meal,
    t,
  ]);

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
    meal && totalMealGrams > 0 ? effectiveMealAmountGrams / totalMealGrams : 1;

  // Calculate nutritional values based on serving size (for foods) or use meal nutrients directly
  const getScaledNutrition = useCallback(() => {
    // For meals, scale nutrients by amount in grams (mealScaleFactor)
    if (meal && mealNutrients) {
      return {
        name: getFoodMealName(),
        category: getProductCategory(),
        calories: roundToDecimalPlaces(mealNutrients.calories * mealScaleFactor),
        protein: roundToDecimalPlaces(mealNutrients.protein * mealScaleFactor),
        carbs: roundToDecimalPlaces(mealNutrients.carbs * mealScaleFactor),
        fat: roundToDecimalPlaces(mealNutrients.fat * mealScaleFactor),
      };
    }

    // For foods, scale by serving size
    const scaleFactor = servingSize / 100; // API data is per 100g

    const effectiveProductDetails = refetchedProductDetails ?? productDetails;
    let dataSource: 'openfood' | 'usda' | 'local' | 'ai' | 'musclog' | undefined;
    if (food || localFood) {
      dataSource = 'local';
    } else if (initialSource === 'ai') {
      dataSource = 'ai';
    } else if ((effectiveProductDetails as any)?.source === 'musclog') {
      dataSource = 'musclog';
    } else if (
      (effectiveProductDetails as any)?.source === 'usda' ||
      productFromSearch?.source === 'usda' ||
      initialSource === 'usda'
    ) {
      dataSource = 'usda';
    } else if (
      effectiveProductDetails ||
      productFromSearch?.source === 'openfood' ||
      initialSource === 'openfood'
    ) {
      dataSource = 'openfood';
    }

    return {
      name: getFoodMealName(),
      category: getProductCategory(),
      calories: roundToDecimalPlaces(nutritionalData.calories * scaleFactor),
      protein: roundToDecimalPlaces(nutritionalData.protein * scaleFactor),
      carbs: roundToDecimalPlaces(nutritionalData.carbs * scaleFactor),
      fat: roundToDecimalPlaces(nutritionalData.fat * scaleFactor),
      source: dataSource,
    };
  }, [
    meal,
    mealNutrients,
    servingSize,
    food,
    localFood,
    initialSource,
    productDetails,
    refetchedProductDetails,
    productFromSearch?.source,
    getFoodMealName,
    getProductCategory,
    nutritionalData.calories,
    nutritionalData.protein,
    nutritionalData.carbs,
    nutritionalData.fat,
    mealScaleFactor,
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

          showSnackbar('success', t('food.foodDetails.successMessage'));
        } catch (err) {
          console.error('Error logging meal:', err);

          captureException(err, {
            data: {
              context: 'FoodMealDetailsModal.handleAddFood',
              // TODO: add meal barcode
            },
          });

          showSnackbar('error', t('food.foodDetails.errorMessage'));
        } finally {
          setIsAddingFood(false);
        }

        return;
      }

      // If editing an existing food log, update it instead of creating a new one
      if (foodLog) {
        try {
          const dateTimestamp = localDayStartMs(selectedDate);

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

          showSnackbar('success', t('food.foodDetails.successMessage'));
        } catch (err) {
          console.error('Error updating food log:', err);

          captureException(err, {
            data: {
              context: 'FoodMealDetailsModal.handleAddFood',
              // TODO: add meal barcod
            },
          });

          showSnackbar('error', t('food.foodDetails.errorMessage'));
        } finally {
          setIsAddingFood(false);
        }

        return;
      }
      // Handle local food
      if (food || localFood) {
        const foodData = food || localFood;

        // If localFood has no name but we have API product details, update it before logging
        // so NutritionService.logFood reads the correct name from the food record
        const effectivePdForName = refetchedProductDetails ?? productDetails;
        if (
          localFood &&
          !localFood.name?.trim() &&
          isSuccessFoodDetailProductState(effectivePdForName)
        ) {
          const { name: correctName, found } = getProductName(effectivePdForName);
          if (found) {
            await localFood.update((record: any) => {
              record.name = correctName;
            });
          }
        }

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

        showSnackbar('success', t('food.foodDetails.successMessage'));
        return;
      }

      // Handle API food: prefer barcode-fetched details over search results to get micros
      let productToSave: any =
        (isSuccessFoodDetailProductState(productDetails) ? productDetails.product : null) ??
        productFromSearch;
      if (!productToSave) {
        throw new Error('Product details not loaded');
      }

      // Apply user edits (e.g. from AI-sourced data) to name, barcode and description
      if (editedOverrides) {
        if (productToSave.fdcId) {
          productToSave = {
            ...productToSave,
            description: editedOverrides.name?.trim() || productToSave.description,
            gtinUpc: editedOverrides.barcode?.trim() || productToSave.gtinUpc,
            ingredients: editedOverrides.description?.trim() || productToSave.ingredients,
          };
        } else {
          const codeFromProduct = (productToSave as { code?: string }).code;
          const fallbackName = getProductName(productToSave).name;
          productToSave = {
            ...productToSave,
            product_name: (editedOverrides.name?.trim() || fallbackName).trim() || fallbackName,
            code: (editedOverrides.barcode?.trim() || codeFromProduct) ?? '',
            ingredients_text: editedOverrides.description?.trim() || productToSave.ingredients_text,
          } as typeof productToSave;
        }
      }

      // Musclog handle
      if ((productDetails as any)?.source === 'musclog') {
        const musclogProduct = (productDetails as any).product;
        const newFood = await FoodService.createFromMusclogProduct(
          musclogProduct,
          {
            calories: nutritionalData.calories,
            protein: nutritionalData.protein,
            carbs: nutritionalData.carbs,
            fat: nutritionalData.fat,
            fiber: nutritionalData.fiber,
            isFavorite: isFavorite,
          },
          barcode ?? undefined
        );

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

        showSnackbar('success', t('food.foodDetails.successMessage'));
        return;
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

        showSnackbar('success', t('food.foodDetails.successMessage'));
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

      showSnackbar('success', t('food.foodDetails.successMessage'));
    } catch (error) {
      console.error('Error tracking food:', error);

      captureException(error, {
        data: {
          context: 'FoodMealDetailsModal.handleAddFood 2',
          // TODO: add meal barcode
        },
      });

      showSnackbar('error', t('food.foodDetails.errorMessage'));
    } finally {
      setIsAddingFood(false);
    }
  }, [
    meal,
    foodLog,
    food,
    localFood,
    productDetails,
    productFromSearch,
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
    refetchedProductDetails,
    barcode,
  ]);

  const handleOpenEditPopUp = useCallback(() => {
    const productCode =
      (productFromSearch && 'code' in productFromSearch
        ? (productFromSearch as { code?: string }).code
        : undefined) ?? '';
    const currentDescription =
      editedOverrides?.description ??
      food?.description ??
      (productFromSearch as any)?.ingredients_text ??
      (productFromSearch as any)?.ingredients ??
      '';
    setEditForm({
      name: getFoodMealName(),
      barcode: barcode ?? productCode ?? '',
      description: currentDescription,
      calories: formatAppRoundedDecimal(locale, baseNutritionalData.calories, 2),
      protein: formatAppRoundedDecimal(locale, baseNutritionalData.protein, 2),
      carbs: formatAppRoundedDecimal(locale, baseNutritionalData.carbs, 2),
      fat: formatAppRoundedDecimal(locale, baseNutritionalData.fat, 2),
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
    food,
    editedOverrides,
    locale,
  ]);

  const handleSaveEditPopUp = useCallback(() => {
    if (!editForm) {
      return;
    }
    const cal = parseLocalizedDecimalString(editForm.calories, decimalSeparator);
    const pro = parseLocalizedDecimalString(editForm.protein, decimalSeparator);
    const carb = parseLocalizedDecimalString(editForm.carbs, decimalSeparator);
    const f = parseLocalizedDecimalString(editForm.fat, decimalSeparator);
    setEditedOverrides({
      name: editForm.name.trim() || undefined,
      barcode: editForm.barcode.trim() || undefined,
      description: editForm.description.trim() || undefined,
      calories: Number.isFinite(cal) ? cal : undefined,
      protein: Number.isFinite(pro) ? pro : undefined,
      carbs: Number.isFinite(carb) ? carb : undefined,
      fat: Number.isFinite(f) ? f : undefined,
    });
    setEditForm(null);
    setIsEditPopUpVisible(false);
  }, [editForm, decimalSeparator]);

  const handleEditFormNumericChange = useCallback(
    (field: 'calories' | 'protein' | 'carbs' | 'fat') => (value: string) => {
      const numericValue = sanitizeLocalizedDecimalInput(value, decimalSeparator, 2);
      setEditForm((prev) => (prev ? { ...prev, [field]: numericValue } : null));
    },
    [decimalSeparator]
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

  const handleTryAnotherSource = useCallback(async () => {
    if (!barcode) {
      return;
    }

    setIsRefetchingSource(true);

    const effectiveDetails = refetchedProductDetails ?? productDetails;
    const currentSource = inferBarcodeNutritionSource(effectiveDetails, productFromSearch);

    try {
      const attempts: Promise<ProductDetailsQueryData | null>[] = [];

      if (currentSource !== 'openfood') {
        attempts.push(
          fetchOFFProductByBarcode(barcode)
            .then((r) => (r.data && isSuccessStatus(r.data.status) ? r.data : null))
            .catch(() => null)
        );
      }
      if (currentSource !== 'usda') {
        attempts.push(
          fetchUSDAProductByBarcode(barcode)
            .then((raw) =>
              raw ? ({ status: 'success', product: raw, source: 'usda' } as any) : null
            )
            .catch(() => null)
        );
      }
      if (currentSource !== 'musclog') {
        attempts.push(
          fetchMusclogProductByBarcode(barcode)
            .then((raw) =>
              raw ? ({ status: 'success', product: raw, source: 'musclog' } as any) : null
            )
            .catch(() => null)
        );
      }

      const results = await Promise.all(attempts);
      const withNonZeroMacros = results.filter((r): r is ProductDetailsQueryData => {
        if (!r) {
          return false;
        }
        const macros = parseCoreMacrosFromAlternateSource(r);
        return macros !== null && !areCoreMacrosEffectivelyZero(macros);
      });

      const found = withNonZeroMacros[0] ?? null;

      if (found) {
        setAlternateSourceLookupFailed(false);
        setRefetchedProductDetails(found);
      } else {
        setAlternateSourceLookupFailed(true);
        setLocalCanEdit(true);
      }
    } catch (error) {
      captureException(error, { data: { context: 'FoodMealDetailsModal.handleTryAnotherSource' } });
      setAlternateSourceLookupFailed(true);
      setLocalCanEdit(true);
    } finally {
      setIsRefetchingSource(false);
    }
  }, [barcode, productDetails, productFromSearch, refetchedProductDetails]);

  // Reset matched portion and edit overrides when modal closes
  useEffect(() => {
    if (!visible) {
      setMatchedPortion(null);
      setEditedOverrides(null);
      setIsEditPopUpVisible(false);
      setShowBarcodeScannerInEdit(false);
      setRefetchedProductDetails(null);
      setIsRefetchingSource(false);
      setAlternateSourceLookupFailed(false);
      setLocalCanEdit(canEdit);
    }
  }, [visible, canEdit]);

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
        scrollViewRef={scrollViewRef}
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
                (isLoadingDetails && mode !== 'meal' && mode !== 'food' && mode !== 'foodLog') ||
                (isLoadingMealNutrients && mode === 'meal')
              }
              loading={isAddingFood}
            />
          </View>
        }
      >
        <View className="flex-1 px-4 pb-6">
          <FoodNutritionSectionCard
            food={scaledFood}
            canEdit={localCanEdit || hasNoNutrition}
            mode={mode}
            showIncompleteWarning={hasNoNutrition}
            onEditPress={handleOpenEditPopUp}
            nutritionalData={nutritionalData}
            servingSize={servingSize}
            isLoadingDetails={isLoadingDetails}
            onTryAnotherSource={
              hasAllZeroMacros && !alternateSourceLookupFailed ? handleTryAnotherSource : undefined
            }
            isRefetchingSource={isRefetchingSource}
            alternateSourceNotFound={alternateSourceLookupFailed ? hasAllZeroMacros : false}
          />

          {/* Form Sections */}
          <View className="mt-6 gap-6">
            {/* Same serving size input for both food and meal (editable, same UX) */}
            {mode !== 'meal' ? (
              <ServingSizeSelector
                value={servingSize}
                onChange={setServingSize}
                onFocus={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              />
            ) : (
              <ServingSizeSelector
                value={mealAmountGrams}
                onChange={(v) => setMealAmountGrams(Math.round(v))}
                onFocus={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
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

            <DatePickerInput
              selectedDate={selectedDate}
              onPress={() => setIsDatePickerVisible(true)}
              variant="default"
            />
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
              setSelectedDate(localCalendarDayDate(date));
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
            label={t('common.save')}
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

            {/* Description */}
            <TextInput
              label={t('food.foodDetails.description')}
              value={editForm.description}
              onChangeText={(text) =>
                setEditForm((prev) => (prev ? { ...prev, description: text } : null))
              }
              placeholder={t('food.foodDetails.descriptionPlaceholder')}
              icon={<AlignLeft size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
              multiline
            />

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
              allowDecimals
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
                allowDecimals
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
                allowDecimals
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
                allowDecimals
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
