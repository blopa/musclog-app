import {
  AlignLeft,
  BarChart,
  BookmarkPlus,
  Cookie,
  Droplet,
  Dumbbell,
  Edit3,
  Leaf,
  Pencil,
  PlusCircle,
  RefreshCcwDot,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

import { BarcodeInput } from '@/components/BarcodeInput';
import { BottomPopUp } from '@/components/BottomPopUp';
import { useCameraPermissions } from '@/components/CameraView';
import {
  type FoodDetailsNutritionSectionMode,
  FoodNutritionSectionCard,
} from '@/components/cards/FoodNutritionSectionCard';
import { MealIngredient } from '@/components/cards/MealNutritionHighlightCard';
import { FilterTabs } from '@/components/FilterTabs';
import { MacroInput } from '@/components/MacroInput';
import {
  type MicronutrientFormStrings,
  micronutrientFormStringsFromMicros,
  MicronutrientsExpandableSection,
  parseMicronutrientFormStringsToPartial,
} from '@/components/MicronutrientsExpandableSection';
import { ServingSizeSelector } from '@/components/ServingSizeSelector';
import { Button } from '@/components/theme/Button';
import { StepperInput } from '@/components/theme/StepperInput';
import { TextInput } from '@/components/theme/TextInput';
import type { Units } from '@/constants/settings';
import { useSnackbar } from '@/context/SnackbarContext';
import { database } from '@/database';
import type { DecryptedNutritionLogSnapshot, MealType, MicrosData } from '@/database/models';
import Food from '@/database/models/Food';
import FoodPortion from '@/database/models/FoodPortion';
import Meal from '@/database/models/Meal';
import {
  FoodPortionService,
  FoodService,
  MealService,
  NutritionService,
} from '@/database/services';
import {
  fetchMusclogProductByBarcode,
  fetchOFFProductByBarcode,
  fetchUSDAProductByBarcode,
  type ProductDetailsQueryData,
  useFoodProductDetails,
} from '@/hooks/useFoodProductDetails';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import {
  isMappedNutriments,
  isSuccessFoodDetailProductState,
  isSuccessStatus,
} from '@/types/guards/openFoodFacts';
import {
  localCalendarDayDate,
  localCalendarDayDateFromDayKeyMs,
  localDayStartMs,
} from '@/utils/calendarDate';
import {
  getProductBarcodeFromSearchProduct,
  inferBarcodeNutritionSource,
  parseCoreMacrosFromAlternateSource,
  parseServingSizeFromProduct,
} from '@/utils/externalFoodProduct';
import { formatAppRoundedDecimal } from '@/utils/formatAppNumber';
import { formatDisplayGrams } from '@/utils/formatDisplayWeight';
import { handleError } from '@/utils/handleError';
import {
  applyInferredCaloriesFromMacrosIfNeeded,
  inferCaloriesFromMacrosPer100g,
  toFiniteMacro,
} from '@/utils/inferCaloriesFromMacros';
import {
  getDecimalSeparator,
  parseLocalizedDecimalString,
  sanitizeLocalizedDecimalInput,
} from '@/utils/localizedDecimalInput';
import { getMusclogNutritionPer100g } from '@/utils/musclogProduct';
import {
  extractLabelsFromOFFProduct,
  getNutrimentsFromV3Nutrition,
  getNutrimentsWithFallback,
  getNutrimentValue,
  mapOpenFoodFactsProduct,
} from '@/utils/openFoodFactsMapper';
import { getProductName } from '@/utils/productName';
import { roundToDecimalPlaces } from '@/utils/roundDecimal';
import { getMassUnitLabel } from '@/utils/unitConversion';
import { mapUSDAFoodToUnified, mapUSDANutritient } from '@/utils/usdaMapper';

import { BarcodeCameraModal } from './BarcodeCameraModal';
import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FoodNotFoundModal } from './FoodNotFoundModal';
import { FullScreenModal } from './FullScreenModal';
import { TimePickerInput } from './TimePickerInput';
import { TimePickerModal } from './TimePickerModal';

function computeMealScaleFactor(
  meal:
    | {
        resolvedNutritionBasis: 'per_recipe' | 'per_serving' | 'per_gram';
        recipeServingsCount?: number;
        servingGrams?: number;
      }
    | null
    | undefined,
  mealAmountGrams: number,
  effectiveMealAmountGrams: number,
  totalMealGrams: number
): number {
  if (!meal) {
    return 1;
  }

  const clamped = Math.max(0.01, mealAmountGrams);

  if (meal.resolvedNutritionBasis === 'per_serving') {
    return clamped / Math.max(1, meal.recipeServingsCount ?? 1);
  }

  if (meal.resolvedNutritionBasis === 'per_gram') {
    return totalMealGrams > 0
      ? (clamped * Math.max(1, meal.servingGrams ?? 1)) / totalMealGrams
      : 1;
  }

  return totalMealGrams > 0 ? Math.max(0.01, effectiveMealAmountGrams) / totalMealGrams : 1;
}

function getMealDefaultTime(mealType: MealType, date: Date): Date {
  const d = new Date(date);
  switch (mealType) {
    case 'breakfast':
      d.setHours(8, 0, 0, 0);
      break;
    case 'lunch':
      d.setHours(12, 30, 0, 0);
      break;
    case 'dinner':
      d.setHours(19, 0, 0, 0);
      break;
    case 'snack':
      d.setHours(15, 0, 0, 0);
      break;
    default:
      d.setHours(12, 0, 0, 0);
  }

  return d;
}

function areCoreMacrosEffectivelyZero(data: {
  calories?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
  fiber?: unknown;
}): boolean {
  const eps = 1e-6;
  return (
    Math.abs(toFiniteMacro(data.calories)) < eps &&
    Math.abs(toFiniteMacro(data.protein)) < eps &&
    Math.abs(toFiniteMacro(data.carbs)) < eps &&
    Math.abs(toFiniteMacro(data.fat)) < eps &&
    Math.abs(toFiniteMacro(data.fiber)) < eps
  );
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
  /** Called before closing when a nutrition log is tracked for the first time, so the parent can trigger confetti. */
  onNutritionLogTracked?: () => void;
  /** When false, the "Try AI Camera" option in FoodNotFoundModal is hidden. Defaults to true. */
  isAiEnabled?: boolean;
  /** When true, show an edit control so the user can correct name, barcode, and macros (e.g. for AI-sourced data). */
  canEdit?: boolean;
};

export function FoodMealTrackingDetailsModal({
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
  onNutritionLogTracked,
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
  const { units, alwaysAllowFoodEditing, intuitiveEatingMode } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [isBarcodeScannerVisible, setIsBarcodeScannerVisible] = useState(false);
  const scrollViewRef = useRef<KeyboardAwareScrollViewRef>(null);

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

  const [servingSize, setServingSize] = useState(() => {
    if (initialServingSize) {
      return initialServingSize;
    }

    if (productFromSearch) {
      return parseServingSizeFromProduct(productFromSearch) || 100;
    }

    return 100;
  });

  // Guard to ensure serving size is only initialized once per product/session
  const hasInitializedServingSizeRef = useRef(false);

  /** Total weight of the meal in grams (sum of all ingredients). Used when tracking a saved meal. */
  const [totalMealGrams, setTotalMealGrams] = useState(0);
  /** Amount in grams to log (user-editable). Defaults to totalMealGrams so "1 full meal". */
  const [mealAmountGrams, setMealAmountGrams] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<MealType>(
    initialMealType ?? inferMealTypeFromTime()
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    localCalendarDayDate(initialDate ? new Date(initialDate) : new Date())
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [isTimePristine, setIsTimePristine] = useState(true);
  const [isFoodNotFoundModalVisible, setIsFoodNotFoundModalVisible] = useState(false);
  const [isFoodDetailsModalVisible, setIsFoodDetailsModalVisible] = useState(
    () => !!meal || !!food || !!foodLog || !!productFromSearch
  );

  // Ensure modal opens immediately if we have enough data from search
  useEffect(() => {
    if (!isFoodDetailsModalVisible && (!!productFromSearch || !!meal || !!food || !!foodLog)) {
      const show = () => {
        setIsFoodDetailsModalVisible(true);
      };
      show();
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
  const [mealIngredientLabels, setMealIngredientLabels] = useState<MealIngredient[]>([]);

  const [isLoadingMealNutrients, setIsLoadingMealNutrients] = useState(false);
  const [foodLogDecrypted, setFoodLogDecrypted] = useState<DecryptedNutritionLogSnapshot | null>(
    null
  );
  const [servingUnitLabel, setServingUnitLabel] = useState<string>('');
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
    fiber?: number;
    micros?: Partial<MicrosData>;
  } | null>(null);
  const [isEditPopUpVisible, setIsEditPopUpVisible] = useState(false);
  const [editMicroOpen, setEditMicroOpen] = useState(false);
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
    fiber: string;
    micronutrients: MicronutrientFormStrings;
  } | null>(null);

  // How the modal was opened: meal / log / local Food row vs. external catalog (barcode or preloaded search product).
  const getMode = (): FoodDetailsNutritionSectionMode => {
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
      return 'externalProduct';
    }

    return null;
  };

  const mode = getMode();
  const resolvedFoodServingMode = foodLog
    ? foodLogDecrypted?.snapshotBasis === 'per_serving'
    : food?.resolvedNutritionBasis === 'per_serving' ||
      localFood?.resolvedNutritionBasis === 'per_serving';
  const resolvedMealServingMode =
    meal?.resolvedNutritionBasis === 'per_serving' || meal?.resolvedNutritionBasis === 'per_gram';

  // Sync localCanEdit when the canEdit prop changes or alwaysAllowFoodEditing changes.
  useEffect(() => {
    const sync = () => {
      if (alwaysAllowFoodEditing && mode !== 'meal') {
        setLocalCanEdit(true);
      } else {
        setLocalCanEdit(canEdit);
      }
    };
    sync();
  }, [canEdit, alwaysAllowFoodEditing, mode]);

  // When opening in "add" mode (not editing a log), apply initialDate from parent (e.g. food screen).
  useEffect(() => {
    if (visible && initialDate && !foodLog) {
      const sync = () => {
        setSelectedDate(localCalendarDayDate(new Date(initialDate)));
      };
      sync();
    }
  }, [visible, initialDate, foodLog]);

  // When opening in duplicate mode, apply initial serving size
  useEffect(() => {
    if (visible && initialServingSize && !foodLog) {
      const sync = () => {
        setServingSize(initialServingSize);
      };
      sync();
    }
  }, [visible, initialServingSize, foodLog]);

  // Keep selected time in sync with selected date and meal when the user hasn't manually picked a time.
  // If the date is today, show current time ("now"); if it's another day, use a meal-type default.
  useEffect(() => {
    if (!isTimePristine) {
      return;
    }

    const today = new Date();
    const isToday =
      selectedDate.getFullYear() === today.getFullYear() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getDate() === today.getDate();

    const syncTime = () => {
      if (isToday) {
        setSelectedTime(new Date());
      } else {
        setSelectedTime(getMealDefaultTime(selectedMeal, selectedDate));
      }
    };
    syncTime();
  }, [selectedDate, selectedMeal, isTimePristine]);

  // Check local database for food with barcode first
  useEffect(() => {
    // Reset checking state when barcode changes
    const resetBarcodeState = () => {
      setHasCheckedLocalFood(false);
      setLocalFood(null);
      setMatchedPortion(null); // Reset matched portion
    };
    resetBarcodeState();

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

  /** User-visible portion label (stored on `FoodPortion.name`); uses locale for decimal separator. */
  const generatePortionName = useCallback(
    (servingSizeGrams: number, unitsParam: Units): string => {
      const amount = formatDisplayGrams(locale, unitsParam, servingSizeGrams);
      const unitLabel = getMassUnitLabel(unitsParam);
      return `${amount}${unitLabel}`;
    },
    [locale]
  );

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
        const closeMatch = allPortions.find(
          (p) => p.gramWeight != null && Math.abs(p.gramWeight - servingSizeGrams) <= 5
        );
        if (closeMatch) {
          return closeMatch;
        }

        // Check user preference for metric or imperial and use proper units
        const portionName = generatePortionName(servingSizeGrams, units);

        const newPortion = await FoodPortionService.createFoodPortion(
          portionName,
          servingSizeGrams,
          undefined, // icon
          'custom',
          { kind: 'mass', scope: 'private' }
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
    const productData = isSuccessFoodDetailProductState(productDetails)
      ? productDetails.product
      : productFromSearch;

    const servingSizeGrams = parseServingSizeFromProduct(productData) || 100;

    // Match serving size to existing portions and store the result
    if (!food && !localFood && (productFromSearch || productDetails)) {
      const portion = await matchServingSizeToPortion(servingSizeGrams);
      setMatchedPortion(portion);
    }

    return servingSizeGrams;
  }, [productDetails, productFromSearch, food, localFood, matchServingSizeToPortion]);

  useEffect(() => {
    const resolveVisibility = () => {
      if (meal) {
        // Meal mode: load nutrients and show details
        setIsFoodDetailsModalVisible(true);
        setIsFavorite(meal.isFavorite);
        return;
      }

      if (food) {
        // Local food already available, show details
        setIsFoodDetailsModalVisible(true);
        return;
      }

      if (localFood) {
        // Local food found by barcode lookup, show details
        setIsFoodDetailsModalVisible(true);
        setIsFavorite(localFood.isFavorite);
        return;
      }

      const nutriments = productFromSearch ? getNutrimentsWithFallback(productFromSearch) : null;
      const isUSDASearchResult = productFromSearch?.source === 'usda';

      // Use preloaded search result (no network fetch) – fixes Android modal not opening
      if (getProductName(productFromSearch).found && (nutriments || isUSDASearchResult)) {
        setIsFoodDetailsModalVisible(true);
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
    };
    resolveVisibility();
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
      const reset = () => {
        setMealNutrients(null);
        setMealIngredientLabels([]);
        setTotalMealGrams(0);
        setMealAmountGrams(0);
      };
      reset();
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
          let rawGrams = 0;
          const ingredientLabels: MealIngredient[] = [];
          for (const mf of mealWithFoods.foods) {
            const [gramWeight, nutrients] = await Promise.all([
              mf.getReferenceGramWeight(),
              mf.getNutrients(),
            ]);
            rawGrams += gramWeight;

            let ingredientName = t('food.unknownFood');
            try {
              const ingredientFood = await mf.food;
              if (ingredientFood?.name?.trim()) {
                ingredientName = ingredientFood.name.trim();
              }
            } catch (error) {
              console.warn('Error loading meal ingredient food:', error);
            }

            ingredientLabels.push({
              name: ingredientName,
              grams: roundToDecimalPlaces(gramWeight),
              kcal: roundToDecimalPlaces(nutrients.calories),
              protein: roundToDecimalPlaces(nutrients.protein),
              carbs: roundToDecimalPlaces(nutrients.carbs),
              fat: roundToDecimalPlaces(nutrients.fat),
            });
          }
          setMealIngredientLabels(ingredientLabels);
          // Use prepared weight as the portion reference when the user set it,
          // otherwise fall back to the raw ingredient sum.
          const referenceGrams = Math.round(meal.preparedWeightGrams ?? rawGrams);
          setTotalMealGrams(referenceGrams);
          if (meal.resolvedNutritionBasis === 'per_recipe') {
            setMealAmountGrams(referenceGrams > 0 ? referenceGrams : 100);
          } else {
            setMealAmountGrams(1);
          }
        } else {
          setMealIngredientLabels([]);
          setTotalMealGrams(0);
          setMealAmountGrams(meal.resolvedNutritionBasis === 'per_recipe' ? 100 : 1);
        }
      } catch (error) {
        console.error('Error loading meal nutrients:', error);
        setMealNutrients({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
        setMealIngredientLabels([]);
        setTotalMealGrams(0);
        setMealAmountGrams(meal.resolvedNutritionBasis === 'per_recipe' ? 100 : 1);
      } finally {
        setIsLoadingMealNutrients(false);
      }
    };

    loadMealNutrients();
  }, [locale, meal, t, units]);

  // If we are given a foodLog, initialize edit mode values from it and load decrypted snapshot
  useEffect(() => {
    if (!foodLog) {
      const clear = () => {
        setFoodLogDecrypted(null);
      };
      clear();
      return;
    }

    const showModal = () => {
      setIsFoodDetailsModalVisible(true);
    };
    showModal();

    const setMeal = () => {
      try {
        setSelectedMeal(foodLog.type || 'other');
      } catch (e) {
        setSelectedMeal('lunch');
      }
    };
    setMeal();

    const setDate = () => {
      try {
        setSelectedDate(localCalendarDayDateFromDayKeyMs(foodLog.date));
      } catch (e) {
        setSelectedDate(localCalendarDayDate(new Date()));
      }
    };
    setDate();

    const setTime = () => {
      try {
        setSelectedTime(new Date(foodLog.createdAt));
      } catch (e) {
        setSelectedTime(new Date());
      }
    };
    setTime();
    const markTimePristine = () => {
      setIsTimePristine(false);
    };
    markTimePristine();

    let cancelled = false;
    foodLog.getDecryptedSnapshot().then((snap: DecryptedNutritionLogSnapshot) => {
      if (!cancelled) {
        setFoodLogDecrypted(snap);
      }
    });

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
        alcohol: foodLogDecrypted.loggedMicros?.alcohol ?? 0,
        potassium: foodLogDecrypted.loggedMicros?.potassium ?? 0,
        magnesium: foodLogDecrypted.loggedMicros?.magnesium ?? 0,
        zinc: foodLogDecrypted.loggedMicros?.zinc ?? 0,
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
        alcohol: foodData!.micros?.alcohol || 0,
        potassium: foodData!.micros?.potassium || 0,
        magnesium: foodData!.micros?.magnesium || 0,
        zinc: foodData!.micros?.zinc || 0,
      };
    }

    const effectiveProductDetails = refetchedProductDetails ?? productDetails;

    if (isSuccessFoodDetailProductState(effectiveProductDetails)) {
      const product = effectiveProductDetails.product;

      if ((effectiveProductDetails as any).source === 'musclog') {
        const nutrition = getMusclogNutritionPer100g(product as any);
        return {
          calories: nutrition.calories,
          protein: nutrition.protein,
          carbs: nutrition.carbs,
          fat: nutrition.fat,
          fiber: nutrition.fiber,
          sugar: nutrition.sugar,
          saturatedFat: nutrition.saturatedFat,
          sodium: nutrition.sodium,
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
          // Sodium is reported in MG by USDA; convert to grams for storage
          sodium:
            ((mapUSDANutritient(nutrients, '1093') ?? mapUSDANutritient(nutrients, '307') ?? 0) /
              1000) *
            normFactor,
          alcohol:
            (mapUSDANutritient(nutrients, '1018') ?? mapUSDANutritient(nutrients, '221') ?? 0) *
            normFactor,
          potassium:
            ((mapUSDANutritient(nutrients, '1092') ?? mapUSDANutritient(nutrients, '306') ?? 0) /
              1000) *
            normFactor,
          magnesium:
            ((mapUSDANutritient(nutrients, '1090') ?? mapUSDANutritient(nutrients, '304') ?? 0) /
              1000) *
            normFactor,
          zinc:
            ((mapUSDANutritient(nutrients, '1095') ?? mapUSDANutritient(nutrients, '309') ?? 0) /
              1000) *
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
        // OFF stores minerals in grams per 100g — no unit conversion needed
        alcohol: getNutrimentValue(nutrients, 'alcohol') ?? 0,
        potassium: getNutrimentValue(nutrients, 'potassium') ?? 0,
        magnesium: getNutrimentValue(nutrients, 'magnesium') ?? 0,
        zinc: getNutrimentValue(nutrients, 'zinc') ?? 0,
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
        // Sodium is reported in MG by USDA; convert to grams for storage
        sodium:
          ((mapUSDANutritient(nutrients, '1093') ?? mapUSDANutritient(nutrients, '307') ?? 0) /
            1000) *
          normFactor,
        alcohol:
          (mapUSDANutritient(nutrients, '1018') ?? mapUSDANutritient(nutrients, '221') ?? 0) *
          normFactor,
        potassium:
          ((mapUSDANutritient(nutrients, '1092') ?? mapUSDANutritient(nutrients, '306') ?? 0) /
            1000) *
          normFactor,
        magnesium:
          ((mapUSDANutritient(nutrients, '1090') ?? mapUSDANutritient(nutrients, '304') ?? 0) /
            1000) *
          normFactor,
        zinc:
          ((mapUSDANutritient(nutrients, '1095') ?? mapUSDANutritient(nutrients, '309') ?? 0) /
            1000) *
          normFactor,
      };
    }

    if (productFromSearch && productFromSearch.source === 'openfood') {
      const mappedProduct = mapOpenFoodFactsProduct(productFromSearch);
      const nut = mappedProduct.nutriments;
      let sugar = 0,
        saturatedFat = 0,
        sodium = 0,
        alcohol = 0,
        potassium = 0,
        magnesium = 0,
        zinc = 0;
      if (isMappedNutriments(nut)) {
        sugar = nut.macronutrients?.sugars ?? 0;
        saturatedFat = nut.macronutrients?.saturatedFat ?? 0;
        sodium = nut.minerals?.sodium ?? nut.other?.salt ?? 0;
        alcohol = nut.macronutrients?.alcohol ?? 0;
        potassium = nut.minerals?.potassium ?? 0;
        magnesium = nut.minerals?.magnesium ?? 0;
        zinc = nut.minerals?.zinc ?? 0;
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
        alcohol,
        potassium,
        magnesium,
        zinc,
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
          alcohol: getNum('alcohol'),
          potassium: getNum('potassium'),
          magnesium: getNum('magnesium'),
          zinc: getNum('zinc'),
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
      alcohol: 0,
      potassium: 0,
      magnesium: 0,
      zinc: 0,
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

  // Split raw data from inferred data
  const rawNutritionalData = getNutritionalData();
  const baseNutritionalData = applyInferredCaloriesFromMacrosIfNeeded(rawNutritionalData);

  const baseMicrosPer100g = useMemo((): MicrosData => {
    if (food || localFood) {
      return { ...((food || localFood)!.micros ?? {}) };
    }

    if (
      foodLog &&
      foodLogDecrypted?.loggedMicros &&
      Object.keys(foodLogDecrypted.loggedMicros).length > 0
    ) {
      return { ...foodLogDecrypted.loggedMicros };
    }

    const n = rawNutritionalData;
    const out: MicrosData = {};
    if (Number.isFinite(n.sugar)) {
      out.sugar = n.sugar;
    }

    if (Number.isFinite(n.saturatedFat)) {
      out.saturatedFat = n.saturatedFat;
    }

    if (Number.isFinite(n.sodium)) {
      out.sodium = n.sodium;
    }

    if (Number.isFinite(n.alcohol) && (n.alcohol ?? 0) > 0) {
      out.alcohol = n.alcohol;
    }

    if (Number.isFinite(n.potassium) && (n.potassium ?? 0) > 0) {
      out.potassium = n.potassium;
    }

    if (Number.isFinite(n.magnesium) && (n.magnesium ?? 0) > 0) {
      out.magnesium = n.magnesium;
    }

    if (Number.isFinite(n.zinc) && (n.zinc ?? 0) > 0) {
      out.zinc = n.zinc;
    }

    return out;
  }, [food, localFood, foodLog, foodLogDecrypted, rawNutritionalData]);

  const effectiveMicrosPer100g = useMemo(
    () => ({
      ...baseMicrosPer100g,
      ...(editedOverrides?.micros ?? {}),
    }),
    [baseMicrosPer100g, editedOverrides?.micros]
  );

  // Compute inferred calories from macros for warning display
  const inferredCaloriesPer100g = useMemo(() => {
    return inferCaloriesFromMacrosPer100g(
      rawNutritionalData.protein,
      rawNutritionalData.carbs,
      rawNutritionalData.fat,
      rawNutritionalData.fiber,
      rawNutritionalData.alcohol
    );
  }, [
    rawNutritionalData.protein,
    rawNutritionalData.carbs,
    rawNutritionalData.fat,
    rawNutritionalData.fiber,
    rawNutritionalData.alcohol,
  ]);

  const showCaloriesTooLowWarning = useMemo(() => {
    const rawCal = toFiniteMacro(rawNutritionalData.calories);
    return (
      mode === 'externalProduct' &&
      rawCal > 0 &&
      inferredCaloriesPer100g > 0 &&
      (rawCal < inferredCaloriesPer100g * 0.7 || rawCal > inferredCaloriesPer100g * 1.3) &&
      editedOverrides?.calories == null
    );
  }, [rawNutritionalData.calories, inferredCaloriesPer100g, mode, editedOverrides]);

  const nutritionQuality = useMemo(() => {
    if (food || localFood) {
      const foodData = food || localFood;
      const hasQuality =
        foodData!.nutriscore ||
        foodData!.ecoscore ||
        foodData!.novaGroup != null ||
        foodData!.labels;

      if (!hasQuality) {
        return undefined;
      }

      return {
        nutriScore: foodData!.nutriscore,
        ecoScore: foodData!.ecoscore,
        novaGroup: foodData!.novaGroup,
        labels: foodData!.labels,
      };
    }

    if (productFromSearch?.source === 'openfood') {
      const mapped = mapOpenFoodFactsProduct(productFromSearch);
      const hasQuality =
        mapped.nutriscore || mapped.ecoscore || mapped.novaGroup != null || mapped.labels;

      if (!hasQuality) {
        return undefined;
      }

      return {
        nutriScore: mapped.nutriscore,
        ecoScore: mapped.ecoscore,
        novaGroup: mapped.novaGroup,
        labels: mapped.labels,
      };
    }

    const effectiveDetails = refetchedProductDetails ?? productDetails;
    if (
      isSuccessFoodDetailProductState(effectiveDetails) &&
      (effectiveDetails as any).source !== 'usda'
    ) {
      const product = effectiveDetails.product;
      const nutriScore =
        typeof (product as any).nutriscore_grade === 'string' && (product as any).nutriscore_grade
          ? (product as any).nutriscore_grade.toLowerCase()
          : undefined;

      const ecoScore =
        typeof (product as any).ecoscore_grade === 'string' && (product as any).ecoscore_grade
          ? (product as any).ecoscore_grade.toLowerCase()
          : undefined;

      const novaGroup =
        typeof (product as any).nova_group === 'number' ? (product as any).nova_group : undefined;

      const labels = extractLabelsFromOFFProduct(product as any);
      const hasQuality = nutriScore || ecoScore || novaGroup != null || labels;
      if (!hasQuality) {
        return undefined;
      }

      return { nutriScore, ecoScore, novaGroup, labels };
    }

    return undefined;
  }, [food, localFood, productFromSearch, productDetails, refetchedProductDetails]);

  const nutritionalData = useMemo(() => {
    const macroBase =
      editedOverrides &&
      (editedOverrides.calories != null ||
        editedOverrides.protein != null ||
        editedOverrides.carbs != null ||
        editedOverrides.fat != null ||
        editedOverrides.fiber != null)
        ? {
            ...baseNutritionalData,
            calories: editedOverrides.calories ?? baseNutritionalData.calories,
            protein: editedOverrides.protein ?? baseNutritionalData.protein,
            carbs: editedOverrides.carbs ?? baseNutritionalData.carbs,
            fat: editedOverrides.fat ?? baseNutritionalData.fat,
            fiber: editedOverrides.fiber ?? baseNutritionalData.fiber,
          }
        : baseNutritionalData;

    const pickMicro = (key: 'sugar' | 'saturatedFat' | 'sodium') => {
      const v = effectiveMicrosPer100g[key];
      return typeof v === 'number' && Number.isFinite(v) ? v : macroBase[key];
    };

    const pickMicro2 = (key: 'alcohol' | 'potassium' | 'magnesium' | 'zinc') => {
      const v = effectiveMicrosPer100g[key];
      return typeof v === 'number' && Number.isFinite(v) ? v : (macroBase[key] ?? 0);
    };

    return {
      ...macroBase,
      sugar: pickMicro('sugar'),
      saturatedFat: pickMicro('saturatedFat'),
      sodium: pickMicro('sodium'),
      alcohol: pickMicro2('alcohol'),
      potassium: pickMicro2('potassium'),
      magnesium: pickMicro2('magnesium'),
      zinc: pickMicro2('zinc'),
    };
  }, [baseNutritionalData, editedOverrides, effectiveMicrosPer100g]);

  // External catalog product: nutrition settled, no successful refetch yet, and all core macros are zero
  const hasAllZeroMacros = useMemo(() => {
    if (mode !== 'externalProduct' || refetchedProductDetails) {
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
  const getFoodMealName = () => {
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
  };

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
    if (hasInitializedServingSizeRef.current) {
      return;
    }

    if (productFromSearch || productDetails || food || localFood || foodLog) {
      const loadDefaultSize = async () => {
        if (foodLog) {
          try {
            const displayAmount = await foodLog.getDisplayAmount();
            if (typeof displayAmount.value === 'number' && !Number.isNaN(displayAmount.value)) {
              setServingSize(Math.round(displayAmount.value * 1000) / 1000);
              hasInitializedServingSizeRef.current = true;
            }
          } catch (e) {
            // ignore
          }
        } else if (food || localFood) {
          const targetFood = food || localFood;
          if (targetFood?.resolvedNutritionBasis === 'per_serving') {
            setServingSize(initialServingSize || 1);
          } else if (initialServingSize) {
            setServingSize(initialServingSize);
          } else {
            try {
              const defaultPortion = await targetFood?.getDefaultPortionAsync();
              if (defaultPortion?.gramWeight && defaultPortion.gramWeight > 0) {
                setServingSize(defaultPortion.gramWeight);
              } else {
                setServingSize(100);
              }
            } catch {
              setServingSize(100);
            }
          }

          hasInitializedServingSizeRef.current = true;
        } else {
          const defaultSize = await getDefaultServingSize();
          setServingSize(defaultSize);
          hasInitializedServingSizeRef.current = true;
        }
      };

      loadDefaultSize();
    }
  }, [
    productFromSearch,
    productDetails,
    getDefaultServingSize,
    food,
    localFood,
    foodLog,
    initialServingSize,
  ]);

  const parsedProductServingSize = useMemo(() => {
    if (productFromSearch?.source === 'usda') {
      return undefined;
    }

    const servingStr = productFromSearch?.serving_size;
    if (!servingStr) {
      return undefined;
    }

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

    return undefined;
  }, [productFromSearch?.source, productFromSearch?.serving_size]);

  const parsedProductMeasures = useMemo(() => {
    const result: { name: string; gramWeight: number }[] = [];

    // foodMeasures from search results (Survey FNDDS foods)
    if (productFromSearch?.source === 'usda') {
      const measures: { disseminationText?: string; gramWeight?: number }[] =
        (productFromSearch as any)._raw?.foodMeasures ?? [];
      for (const m of measures) {
        if (m.gramWeight && m.gramWeight > 0 && m.disseminationText) {
          result.push({ name: m.disseminationText, gramWeight: m.gramWeight });
        }
      }
    }

    // foodPortions from detailed food response (Foundation / Survey FNDDS)
    const detailProduct =
      (productDetails as any)?.source === 'usda' ? (productDetails as any).product : null;
    if (detailProduct?.foodPortions) {
      const portions: { gramWeight?: number; portionDescription?: string; modifier?: string }[] =
        detailProduct.foodPortions;
      for (const p of portions) {
        if (!p.gramWeight || p.gramWeight <= 0) {
          continue;
        }

        const name = p.portionDescription || p.modifier;
        if (!name) {
          continue;
        }

        if (!result.some((r) => r.gramWeight === p.gramWeight)) {
          result.push({ name, gramWeight: p.gramWeight });
        }
      }
    }

    return result.length > 0 ? result : undefined;
  }, [productFromSearch, productDetails]);

  useEffect(() => {
    let cancelled = false;

    const loadServingUnit = async () => {
      if (
        meal?.resolvedNutritionBasis === 'per_serving' ||
        meal?.resolvedNutritionBasis === 'per_gram'
      ) {
        if (!cancelled) {
          setServingUnitLabel(meal.defaultPortionName || t('food.foodDetails.serving'));
        }

        return;
      }

      if (foodLog?.snapshotBasis === 'per_serving') {
        try {
          const portion = foodLog.portionId ? await foodLog.portion : null;
          if (!cancelled) {
            setServingUnitLabel(portion?.name || t('food.foodDetails.serving'));
          }
        } catch {
          if (!cancelled) {
            setServingUnitLabel(t('food.foodDetails.serving'));
          }
        }

        return;
      }

      const targetFood = food || localFood;
      if (targetFood?.resolvedNutritionBasis === 'per_serving') {
        try {
          const portion = await targetFood.getDefaultPortionAsync();
          if (!cancelled) {
            setServingUnitLabel(portion?.name || t('food.foodDetails.serving'));
          }
        } catch {
          if (!cancelled) {
            setServingUnitLabel(t('food.foodDetails.serving'));
          }
        }

        return;
      }

      if (!cancelled) {
        setServingUnitLabel(getMassUnitLabel(units));
      }
    };

    loadServingUnit();
    return () => {
      cancelled = true;
    };
  }, [meal, foodLog, food, localFood, t, units]);

  // For meals: scale factor = (amount to log in g) / (total meal weight in g). Min 1g to avoid zero.
  const effectiveMealAmountGrams = Math.max(1, mealAmountGrams);
  const mealScaleFactor = computeMealScaleFactor(
    meal,
    mealAmountGrams,
    effectiveMealAmountGrams,
    totalMealGrams
  );

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
    const scaleFactor = resolvedFoodServingMode ? servingSize : servingSize / 100;

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
    resolvedFoodServingMode,
  ]);

  const scaledFood = getScaledNutrition();

  const mealTabs: { id: MealType; label: string }[] = [
    { id: 'breakfast', label: t('food.meals.breakfast') },
    { id: 'lunch', label: t('food.meals.lunch') },
    { id: 'dinner', label: t('food.meals.dinner') },
    { id: 'snack', label: t('food.meals.snacks') },
    { id: 'other', label: t('food.meals.other') },
  ];

  // TODO: move this and other helper functions to it's own hook
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
          const mealGroupId = meal.id;
          const mealGroupName = meal.name ?? undefined;
          for (const mealFood of mealWithFoods.foods) {
            await NutritionService.logFood(
              mealFood.foodId,
              selectedDate,
              selectedMeal,
              mealFood.amount * mealScaleFactor,
              mealFood.portionId,
              undefined,
              mealGroupId,
              mealGroupName
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

          onNutritionLogTracked?.();
          onClose();
          onFoodTracked?.();

          showSnackbar('success', t('food.foodDetails.successMessage'));
        } catch (err) {
          handleError(err, 'FoodMealTrackingDetailsModal.handleAddFood', {
            snackbarMessage: t('food.foodDetails.errorMessage'),
          });
        } finally {
          setIsAddingFood(false);
        }

        return;
      }

      // If editing an existing food log, update it instead of creating a new one
      if (foodLog) {
        try {
          const dateTimestamp = localDayStartMs(selectedDate);

          const updates: Promise<unknown>[] = [
            foodLog.updateAmount(servingSize),
            foodLog.updateMealType(selectedMeal),
            foodLog.updateDate(dateTimestamp),
          ];

          if (!resolvedFoodServingMode) {
            updates.push(foodLog.updatePortion(undefined));
          }

          await Promise.all(updates);

          // Call callback if provided
          onAddFood?.({ servingSize, meal: selectedMeal, date: selectedDate });

          onClose();
          onFoodTracked?.();

          showSnackbar('success', t('food.foodDetails.successMessage'));
        } catch (err) {
          handleError(err, 'FoodMealTrackingDetailsModal.handleAddFood', {
            snackbarMessage: t('food.foodDetails.errorMessage'),
          });
        } finally {
          setIsAddingFood(false);
        }

        return;
      }
      // Handle local food
      if (food || localFood) {
        const foodData = food || localFood;

        const effectivePdForName = refetchedProductDetails ?? productDetails;
        const pendingFoodUpdates: Record<string, unknown> = {};

        // Apply user edits (name, barcode, description, macros, micros) to the persisted food record
        if (editedOverrides) {
          if (editedOverrides.name != null) {
            pendingFoodUpdates.name = editedOverrides.name;
          }

          if (editedOverrides.barcode != null) {
            pendingFoodUpdates.barcode = editedOverrides.barcode;
          }

          if (editedOverrides.description != null) {
            pendingFoodUpdates.description = editedOverrides.description;
          }

          if (editedOverrides.calories != null) {
            pendingFoodUpdates.calories = editedOverrides.calories;
          }

          if (editedOverrides.protein != null) {
            pendingFoodUpdates.protein = editedOverrides.protein;
          }

          if (editedOverrides.carbs != null) {
            pendingFoodUpdates.carbs = editedOverrides.carbs;
          }

          if (editedOverrides.fat != null) {
            pendingFoodUpdates.fat = editedOverrides.fat;
          }

          if (editedOverrides.fiber != null) {
            pendingFoodUpdates.fiber = editedOverrides.fiber;
          }

          if (editedOverrides.micros != null) {
            pendingFoodUpdates.micros = effectiveMicrosPer100g;
          }
        }

        // If localFood has no name and no name override, try to fill from API details
        // so NutritionService.logFood reads the correct name from the food record
        if (
          localFood &&
          !localFood.name?.trim() &&
          pendingFoodUpdates.name == null &&
          isSuccessFoodDetailProductState(effectivePdForName)
        ) {
          const { name: correctName, found } = getProductName(effectivePdForName);
          if (found) {
            pendingFoodUpdates.name = correctName;
          }
        }

        // Persist inferred per-100g calories so logFood snapshot matches the modal (Food row was 0 kcal).
        if (
          toFiniteMacro(foodData!.calories) <= 0 &&
          toFiniteMacro(nutritionalData.calories) > 0 &&
          pendingFoodUpdates.calories == null
        ) {
          pendingFoodUpdates.calories = nutritionalData.calories;
        }

        const shouldPersistFoodUpdates =
          Object.keys(pendingFoodUpdates).length > 0 || (isFavorite && !foodData!.isFavorite);

        if (shouldPersistFoodUpdates) {
          await database.write(async () => {
            if (Object.keys(pendingFoodUpdates).length > 0) {
              await foodData!.update((record: any) => {
                for (const [key, value] of Object.entries(pendingFoodUpdates)) {
                  record[key] = value;
                }
              });
            }

            if (isFavorite && !foodData!.isFavorite) {
              await foodData!.update((record: any) => {
                record.isFavorite = true;
              });
            }
          });
        }

        // Create nutrition log with local food
        const logFoodPromise = NutritionService.logFood(
          foodData!.id,
          selectedDate,
          selectedMeal,
          servingSize
        );

        await Promise.all([logFoodPromise, new Promise((resolve) => setTimeout(resolve, 100))]);

        // Call the original callback if provided
        onAddFood?.({
          servingSize,
          meal: selectedMeal,
          date: selectedDate,
        });

        onNutritionLogTracked?.();
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
        const pdForCreate = refetchedProductDetails ?? productDetails;
        const usdaRawMicros =
          pdForCreate && (pdForCreate as any)?.product?.foodNutrients
            ? ((pdForCreate as any).product as any).foodNutrients.reduce((acc: any, n: any) => {
                const num = n.nutrientNumber || n.number || n.nutrient?.number;
                if (num) {
                  acc[num] = n.value ?? n.amount;
                }
                return acc;
              }, {})
            : {};
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
            micros: {
              ...usdaRawMicros,
              ...effectiveMicrosPer100g,
            },
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
      const pdForOffCreate = refetchedProductDetails ?? productDetails;
      const offRawNutriments =
        pdForOffCreate && (pdForOffCreate as any)?.product?.nutriments
          ? ((pdForOffCreate as any).product as any).nutriments
          : {};

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
          micros: {
            ...offRawNutriments,
            ...effectiveMicrosPer100g,
          },
          isFavorite: isFavorite,
          nutriscore:
            typeof productToSave.nutriscore_grade === 'string' && productToSave.nutriscore_grade
              ? productToSave.nutriscore_grade.toLowerCase()
              : productFromSearch?.nutriscore,
          ecoscore:
            typeof productToSave.ecoscore_grade === 'string' && productToSave.ecoscore_grade
              ? productToSave.ecoscore_grade.toLowerCase()
              : productFromSearch?.ecoscore,
          novaGroup:
            typeof productToSave.nova_group === 'number'
              ? productToSave.nova_group
              : productFromSearch?.novaGroup,
          labels: extractLabelsFromOFFProduct(productToSave) ?? productFromSearch?.labels,
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

      onNutritionLogTracked?.();
      onClose();
      onFoodTracked?.();

      showSnackbar('success', t('food.foodDetails.successMessage'));
    } catch (error) {
      handleError(error, 'FoodMealTrackingDetailsModal.handleAddFood 2', {
        snackbarMessage: t('food.foodDetails.errorMessage'),
      });
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
    resolvedFoodServingMode,
    refetchedProductDetails,
    barcode,
    effectiveMicrosPer100g,
  ]);

  const handleOpenEditPopUp = useCallback(() => {
    const productCode = getProductBarcodeFromSearchProduct(productFromSearch);

    const currentBarcode =
      editedOverrides?.barcode ??
      food?.barcode ??
      localFood?.barcode ??
      barcode ??
      productCode ??
      '';

    const currentDescription =
      editedOverrides?.description ??
      food?.description ??
      (productFromSearch as any)?.ingredients_text ??
      (productFromSearch as any)?.ingredients ??
      '';

    setEditForm({
      name: getFoodMealName(),
      barcode: currentBarcode,
      description: currentDescription,
      calories: formatAppRoundedDecimal(locale, nutritionalData.calories, 2),
      protein: formatAppRoundedDecimal(locale, nutritionalData.protein, 2),
      carbs: formatAppRoundedDecimal(locale, nutritionalData.carbs, 2),
      fat: formatAppRoundedDecimal(locale, nutritionalData.fat, 2),
      fiber: formatAppRoundedDecimal(locale, nutritionalData.fiber, 2),
      micronutrients: micronutrientFormStringsFromMicros(effectiveMicrosPer100g, locale),
    });
    setEditMicroOpen(false);
    setIsEditPopUpVisible(true);
  }, [
    productFromSearch,
    editedOverrides?.barcode,
    editedOverrides?.description,
    food?.barcode,
    food?.description,
    localFood?.barcode,
    barcode,
    getFoodMealName,
    locale,
    nutritionalData.calories,
    nutritionalData.protein,
    nutritionalData.carbs,
    nutritionalData.fat,
    nutritionalData.fiber,
    effectiveMicrosPer100g,
  ]);

  const handleSaveEditPopUp = useCallback(() => {
    if (!editForm) {
      return;
    }
    const cal = parseLocalizedDecimalString(editForm.calories, decimalSeparator);
    const pro = parseLocalizedDecimalString(editForm.protein, decimalSeparator);
    const carb = parseLocalizedDecimalString(editForm.carbs, decimalSeparator);
    const f = parseLocalizedDecimalString(editForm.fat, decimalSeparator);
    const fib = parseLocalizedDecimalString(editForm.fiber, decimalSeparator);
    setEditedOverrides({
      name: editForm.name.trim() || undefined,
      barcode: editForm.barcode.trim() || undefined,
      description: editForm.description.trim() || undefined,
      calories: Number.isFinite(cal) ? cal : undefined,
      protein: Number.isFinite(pro) ? pro : undefined,
      carbs: Number.isFinite(carb) ? carb : undefined,
      fat: Number.isFinite(f) ? f : undefined,
      fiber: Number.isFinite(fib) ? fib : undefined,
      micros: parseMicronutrientFormStringsToPartial(editForm.micronutrients, decimalSeparator),
    });
    setEditForm(null);
    setIsEditPopUpVisible(false);
  }, [editForm, decimalSeparator]);

  const handleAcceptInferredCalories = useCallback(() => {
    setEditedOverrides((prev) => ({
      ...prev,
      calories: roundToDecimalPlaces(inferredCaloriesPer100g, 2),
    }));
  }, [inferredCaloriesPer100g]);

  const handleEditFormNumericChange = useCallback(
    (field: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber') => (value: string) => {
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
      handleError(error, 'FoodMealTrackingDetailsModal.handleTryAnotherSource');
      setAlternateSourceLookupFailed(true);
      setLocalCanEdit(true);
    } finally {
      setIsRefetchingSource(false);
    }
  }, [barcode, productDetails, productFromSearch, refetchedProductDetails]);

  // Reset matched portion and edit overrides when modal closes
  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setMatchedPortion(null);
        setEditedOverrides(null);
        setIsEditPopUpVisible(false);
        setEditMicroOpen(false);
        setRefetchedProductDetails(null);
        setIsRefetchingSource(false);
        setAlternateSourceLookupFailed(false);
        setLocalCanEdit(canEdit);
        hasInitializedServingSizeRef.current = false;
        setSelectedTime(new Date());
        setIsTimePristine(true);
      };
      reset();
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
                (mode === 'meal' && mealAmountGrams < (resolvedMealServingMode ? 0.5 : 1)) ||
                (isLoadingDetails && (mode === 'externalProduct' || mode === null)) ||
                (isLoadingMealNutrients && mode === 'meal')
              }
              loading={isAddingFood}
            />
          </View>
        }
      >
        <View className="flex-1 px-4 pb-6">
          <FoodNutritionSectionCard
            nutritionQuality={nutritionQuality}
            food={scaledFood}
            canEdit={localCanEdit || hasNoNutrition}
            mode={mode}
            showIncompleteWarning={hasNoNutrition}
            onEditPress={handleOpenEditPopUp}
            nutritionalData={nutritionalData}
            servingSize={servingSize}
            servingBasis={resolvedFoodServingMode ? 'per_serving' : 'per_100g'}
            isLoadingDetails={isLoadingDetails}
            onTryAnotherSource={
              hasAllZeroMacros && !alternateSourceLookupFailed ? handleTryAnotherSource : undefined
            }
            isRefetchingSource={isRefetchingSource}
            alternateSourceNotFound={alternateSourceLookupFailed ? hasAllZeroMacros : false}
            caloriesTooLowWarning={
              showCaloriesTooLowWarning
                ? {
                    inferredCalories: roundToDecimalPlaces(inferredCaloriesPer100g, 2),
                    onAccept: handleAcceptInferredCalories,
                  }
                : undefined
            }
            intuitiveMode={intuitiveEatingMode}
            ingredients={mode === 'meal' ? mealIngredientLabels : undefined}
          />

          {/* Form Sections */}
          <View className="mt-6 gap-6">
            {/* Same serving size input for both food and meal (editable, same UX) */}
            {mode !== 'meal' ? (
              resolvedFoodServingMode ? (
                <View className="rounded-2xl border border-border-light bg-bg-card p-4">
                  <StepperInput
                    label={t('food.foodDetails.servings')}
                    value={servingSize}
                    step={0.5}
                    maxFractionDigits={2}
                    onIncrement={() => setServingSize((prev) => prev + 0.5)}
                    onDecrement={() => setServingSize((prev) => Math.max(0.5, prev - 0.5))}
                    onChangeValue={setServingSize}
                    unit={servingUnitLabel || t('food.foodDetails.serving')}
                  />
                </View>
              ) : (
                <ServingSizeSelector
                  value={servingSize}
                  onChange={setServingSize}
                  food={food || localFood || undefined}
                  productServingSize={parsedProductServingSize}
                  productMeasures={parsedProductMeasures}
                  showPortionSelector={Boolean(food || localFood)}
                />
              )
            ) : resolvedMealServingMode ? (
              <View className="rounded-2xl border border-border-light bg-bg-card p-4">
                <StepperInput
                  label={t('food.foodDetails.servings')}
                  value={mealAmountGrams}
                  step={0.5}
                  maxFractionDigits={2}
                  onIncrement={() => setMealAmountGrams((prev) => prev + 0.5)}
                  onDecrement={() => setMealAmountGrams((prev) => Math.max(0.5, prev - 0.5))}
                  onChangeValue={setMealAmountGrams}
                  unit={servingUnitLabel || t('food.foodDetails.serving')}
                />
              </View>
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

            <DatePickerInput
              selectedDate={selectedDate}
              onPress={() => setIsDatePickerVisible(true)}
              variant="default"
            />

            <TimePickerInput
              selectedTime={selectedTime}
              onPress={() => setIsTimePickerVisible(true)}
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

        <TimePickerModal
          visible={isTimePickerVisible}
          onClose={() => setIsTimePickerVisible(false)}
          selectedTime={selectedTime}
          title={t('timePicker.selectTime')}
          onTimeSelect={(time) => {
            setSelectedTime(time);
            setIsTimePristine(false);
          }}
        />
        <BottomPopUp
          visible={isEditPopUpVisible ? editForm !== null : false}
          onClose={() => {
            setIsEditPopUpVisible(false);
            setEditForm(null);
            setEditMicroOpen(false);
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
            <View className="gap-5">
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
              <BarcodeInput
                label={t('food.foodDetails.barcode')}
                value={editForm.barcode}
                onChangeText={(text) =>
                  setEditForm((prev) => (prev ? { ...prev, barcode: text } : null))
                }
                placeholder={t('food.foodDetails.barcodePlaceholder')}
                onScanPress={() => setIsBarcodeScannerVisible(true)}
              />

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
                <MacroInput
                  label={t('food.macros.fiber')}
                  value={editForm.fiber}
                  onChange={handleEditFormNumericChange('fiber')}
                  allowDecimals
                  topRightElement={
                    <Leaf size={theme.iconSize.sm} color={theme.colors.status.emerald} />
                  }
                  variant="success"
                  size="half"
                />
              </View>
              <MicronutrientsExpandableSection
                microOpen={editMicroOpen}
                onToggleMicro={() => setEditMicroOpen((o) => !o)}
                values={editForm.micronutrients}
                decimalSeparator={decimalSeparator}
                onMicronutrientChange={(key, value) =>
                  setEditForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          micronutrients: { ...prev.micronutrients, [key]: value },
                        }
                      : null
                  )
                }
              />
            </View>
          ) : null}
        </BottomPopUp>
      </FullScreenModal>
      {isBarcodeScannerVisible ? (
        <BarcodeCameraModal
          visible={isBarcodeScannerVisible}
          onClose={() => setIsBarcodeScannerVisible(false)}
          onBarcodeScanned={(data) =>
            setEditForm((prev) => (prev ? { ...prev, barcode: data } : null))
          }
          showBarcodeTextSearch={true}
          permissionGranted={permission?.granted ?? null}
          onRequestPermission={requestPermission}
        />
      ) : null}
    </>
  );
}
