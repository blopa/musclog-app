import { database } from '@/database/database-instance';
import type { MealType, MicrosData } from '@/database/models';
import type Food from '@/database/models/Food';
import type FoodPortion from '@/database/models/FoodPortion';
import type Meal from '@/database/models/Meal';
import type { EditedFoodOverrides } from '@/types/foodEditing';
import { isSuccessFoodDetailProductState } from '@/types/guards/openFoodFacts';
import { combineLocalDateAndTime, instantForDateTimeInTimezone } from '@/utils/calendarDate';
import {
  type ExternalFoodProductSource,
  inferBarcodeNutritionSource,
  type ProductDetailsQueryData,
} from '@/utils/externalFoodProduct';
import { toFiniteMacro } from '@/utils/inferCaloriesFromMacros';
import { extractLabelsFromOFFProduct } from '@/utils/openFoodFactsMapper';
import { getProductName } from '@/utils/productName';

import { FoodService } from './FoodService';
import { MealService } from './MealService';
import { NutritionService } from './NutritionService';

export type FoodMealTrackingNutritionData = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  sodium: number;
};

type FoodLogTrackingDetails = {
  timezone?: string;
  portionId?: string;
  updateTrackingDetails: (details: {
    amount: number;
    date: number;
    mealType: MealType;
    portionId?: string;
    timezone?: string;
  }) => Promise<void>;
};

export type FoodMealTrackingActionTarget = {
  meal?: Meal | null;
  food?: Food | null;
  foodLog?: FoodLogTrackingDetails | null;
  localFood: Food | null;
  barcode?: string | null;
  productFromSearch?: any;
  productDetails: ProductDetailsQueryData | null | undefined;
  refetchedProductDetails: ProductDetailsQueryData | null;
  matchedPortion: FoodPortion | null;
};

export type FoodMealTrackingActionSelection = {
  selectedDate: Date;
  selectedTime: Date;
  selectedMeal: MealType;
  servingSize: number;
  isFavorite: boolean;
  mealScaleFactor: number;
  resolvedFoodServingMode: boolean | undefined;
};

export type FoodMealTrackingActionNutrition = {
  nutritionalData: FoodMealTrackingNutritionData;
  effectiveMicrosPer100g: MicrosData;
  editedOverrides: EditedFoodOverrides | null;
};

export type FoodMealTrackingActionInput = {
  target: FoodMealTrackingActionTarget;
  selection: FoodMealTrackingActionSelection;
  nutrition: FoodMealTrackingActionNutrition;
};

export type FoodMealTrackingActionResult =
  | { kind: 'foodLogged' }
  | { kind: 'foodLogUpdated' }
  | { kind: 'mealLogged' };

type FoodUpdatePatch = Partial<
  Pick<
    Food,
    | 'name'
    | 'barcode'
    | 'description'
    | 'calories'
    | 'protein'
    | 'carbs'
    | 'fat'
    | 'fiber'
    | 'micros'
    | 'isFavorite'
  >
>;

// External catalog products are heterogeneous across providers (OFF / USDA / musclog) and flow
// through to FoodService's loosely-typed create methods, so the product itself stays `any`. The
// shapes below name only the fields this service reads or rewrites, so those assumptions stay visible.
type ExternalProductForSave = {
  source: ExternalFoodProductSource;
  product: any;
};

type USDAEditableProduct = {
  description?: string;
  gtinUpc?: string;
  ingredients?: string;
  [key: string]: unknown;
};

type MusclogEditableProduct = {
  name?: string;
  description?: string;
  [key: string]: unknown;
};

type OFFEditableProduct = {
  product_name?: string;
  code?: string;
  ingredients_text?: string;
  [key: string]: unknown;
};

type USDANutrient = {
  nutrientNumber?: string;
  number?: string;
  nutrient?: { number?: string };
  value?: unknown;
  amount?: unknown;
};

/** Direct (non-micros) food fields a user edit can override on an existing record. */
const DIRECT_FOOD_OVERRIDE_KEYS = [
  'name',
  'barcode',
  'description',
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
] as const satisfies readonly (keyof EditedFoodOverrides)[];

/** Copies the listed keys whose values are non-null/undefined into a new object. */
function pickDefined<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[]
): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (source[key] != null) {
      out[key] = source[key];
    }
  }

  return out;
}

export class FoodMealTrackingActionService {
  /**
   * Single entry point for "add food / log meal" from the food-details modal. The returned
   * `kind` drives the host callbacks:
   * - `mealLogged` / `foodLogged` are treated as first-time logs (the caller fires
   *   `onNutritionLogTracked`, e.g. for the confetti). **Every** external-source creation
   *   (OFF / USDA / musclog) and existing-food log returns `foodLogged` — this is intentional and
   *   uniform; earlier per-source branches fired the callback inconsistently.
   * - `foodLogUpdated` (editing an existing log) is not a first-time log and skips that callback.
   */
  static async trackFoodOrMeal({
    target,
    selection,
    nutrition,
  }: FoodMealTrackingActionInput): Promise<FoodMealTrackingActionResult> {
    const loggedDateTime = combineLocalDateAndTime(selection.selectedDate, selection.selectedTime);

    if (target.meal) {
      await this.logMeal(target.meal, selection, loggedDateTime);
      return { kind: 'mealLogged' };
    }

    if (target.foodLog) {
      await this.updateFoodLog(target.foodLog, selection);
      return { kind: 'foodLogUpdated' };
    }

    const foodData = target.food ?? target.localFood;
    if (foodData) {
      await this.persistExistingFoodUpdates(foodData, target, selection, nutrition);
      await this.logFoodAndSettle(foodData.id, selection, loggedDateTime);
      return { kind: 'foodLogged' };
    }

    const newFood = await this.createExternalFood(target, selection, nutrition);
    await this.logFoodAndSettle(newFood.id, selection, loggedDateTime);
    return { kind: 'foodLogged' };
  }

  private static async logMeal(
    meal: Meal,
    selection: FoodMealTrackingActionSelection,
    loggedDateTime: Date
  ): Promise<void> {
    const mealWithFoods = await MealService.getMealWithFoods(meal.id);
    if (!mealWithFoods) {
      throw new Error('Failed to get meal foods');
    }

    const mealGroupName = meal.name ?? undefined;
    for (const mealFood of mealWithFoods.foods) {
      await NutritionService.logFood(
        mealFood.foodId,
        loggedDateTime,
        selection.selectedMeal,
        mealFood.amount * selection.mealScaleFactor,
        mealFood.portionId,
        undefined,
        meal.id,
        mealGroupName
      );
    }

    if (selection.isFavorite !== Boolean(meal.isFavorite)) {
      await MealService.toggleMealFavorite(meal.id);
    }
  }

  private static async updateFoodLog(
    foodLog: FoodLogTrackingDetails,
    selection: FoodMealTrackingActionSelection
  ): Promise<void> {
    const timezone = foodLog.timezone;
    const dateTimestamp = instantForDateTimeInTimezone(
      selection.selectedDate,
      selection.selectedTime,
      timezone
    );

    await foodLog.updateTrackingDetails({
      amount: selection.servingSize,
      date: dateTimestamp,
      mealType: selection.selectedMeal,
      portionId: selection.resolvedFoodServingMode ? foodLog.portionId : undefined,
      timezone,
    });
  }

  private static async persistExistingFoodUpdates(
    foodData: Food,
    target: FoodMealTrackingActionTarget,
    selection: FoodMealTrackingActionSelection,
    nutrition: FoodMealTrackingActionNutrition
  ): Promise<void> {
    const patch = this.buildExistingFoodPatch(foodData, target, selection, nutrition);
    if (Object.keys(patch).length === 0) {
      return;
    }

    await database.write(async () => {
      await foodData.update((record) => {
        Object.assign(record, patch);
      });
    });
  }

  private static buildExistingFoodPatch(
    foodData: Food,
    target: FoodMealTrackingActionTarget,
    selection: FoodMealTrackingActionSelection,
    nutrition: FoodMealTrackingActionNutrition
  ): FoodUpdatePatch {
    const patch: FoodUpdatePatch = {};
    const { editedOverrides, nutritionalData, effectiveMicrosPer100g } = nutrition;

    if (editedOverrides) {
      Object.assign(patch, pickDefined(editedOverrides, DIRECT_FOOD_OVERRIDE_KEYS));
      if (editedOverrides.micros != null) {
        patch.micros = effectiveMicrosPer100g;
      }
    }

    const effectiveDetails = target.refetchedProductDetails ?? target.productDetails;
    if (
      target.localFood &&
      !target.localFood.name?.trim() &&
      patch.name == null &&
      isSuccessFoodDetailProductState(effectiveDetails)
    ) {
      const { name, found } = getProductName(effectiveDetails);
      if (found) {
        patch.name = name;
      }
    }

    if (
      toFiniteMacro(foodData.calories) <= 0 &&
      toFiniteMacro(nutritionalData.calories) > 0 &&
      patch.calories == null
    ) {
      patch.calories = nutritionalData.calories;
    }

    if (selection.isFavorite && !foodData.isFavorite) {
      patch.isFavorite = true;
    }

    return patch;
  }

  private static async createExternalFood(
    target: FoodMealTrackingActionTarget,
    selection: FoodMealTrackingActionSelection,
    nutrition: FoodMealTrackingActionNutrition
  ): Promise<Food> {
    const externalProduct = this.resolveExternalProductForSave(target);
    if (!externalProduct) {
      throw new Error('Product details not loaded');
    }

    const barcodeForSave =
      nutrition.editedOverrides?.barcode?.trim() || target.barcode || undefined;
    const productToSave = this.applyEditedOverridesToExternalProduct(
      externalProduct.source,
      externalProduct.product,
      nutrition.editedOverrides,
      barcodeForSave
    );

    if (externalProduct.source === 'musclog') {
      return FoodService.createFromMusclogProduct(
        productToSave,
        this.buildNutritionPayload(nutrition, selection.isFavorite),
        barcodeForSave
      );
    }

    if (externalProduct.source === 'usda') {
      return FoodService.createFromUSDAProduct(
        productToSave,
        {
          ...this.buildNutritionPayload(nutrition, selection.isFavorite),
          micros: {
            ...this.extractUSDARawMicros(productToSave),
            ...nutrition.effectiveMicrosPer100g,
          },
        },
        target.matchedPortion
      );
    }

    return FoodService.createFromV3Product(
      productToSave,
      {
        ...this.buildNutritionPayload(nutrition, selection.isFavorite),
        micros: {
          ...this.extractOFFRawNutriments(productToSave),
          ...nutrition.effectiveMicrosPer100g,
        },
        nutriscore:
          this.normalizeGrade(productToSave.nutriscore_grade) ??
          target.productFromSearch?.nutriscore,
        ecoscore:
          this.normalizeGrade(productToSave.ecoscore_grade) ?? target.productFromSearch?.ecoscore,
        novaGroup:
          typeof productToSave.nova_group === 'number'
            ? productToSave.nova_group
            : target.productFromSearch?.novaGroup,
        labels: extractLabelsFromOFFProduct(productToSave) ?? target.productFromSearch?.labels,
      },
      target.matchedPortion
    );
  }

  private static resolveExternalProductForSave(
    target: FoodMealTrackingActionTarget
  ): ExternalProductForSave | null {
    const effectiveDetails = target.refetchedProductDetails ?? target.productDetails;

    if (isSuccessFoodDetailProductState(effectiveDetails)) {
      const product = effectiveDetails.product;
      return {
        source: this.sourceFromDetailsProduct(effectiveDetails, product),
        product,
      };
    }

    if (target.productFromSearch) {
      return {
        source: this.sourceFromSearchProduct(target.productFromSearch),
        product: target.productFromSearch,
      };
    }

    return null;
  }

  private static sourceFromDetailsProduct(
    details: ProductDetailsQueryData | null | undefined,
    product: any
  ): ExternalFoodProductSource {
    const source = (details as { source?: unknown } | null | undefined)?.source;
    if (source === 'usda' || source === 'musclog' || source === 'openfood') {
      return source;
    }

    return this.sourceFromProductShape(product);
  }

  private static sourceFromSearchProduct(product: any): ExternalFoodProductSource {
    return inferBarcodeNutritionSource(null, product) ?? this.sourceFromProductShape(product);
  }

  private static sourceFromProductShape(product: any): ExternalFoodProductSource {
    if (product?.source === 'usda' || product?.fdcId) {
      return 'usda';
    }

    if (product?.source === 'musclog') {
      return 'musclog';
    }

    return 'openfood';
  }

  // Applies the user's name/barcode/description edits onto the raw external product before saving.
  // All three sources are handled uniformly here, including musclog — earlier code skipped musclog
  // edits, so editing a musclog product's name/description now persists (intentional).
  private static applyEditedOverridesToExternalProduct(
    source: ExternalFoodProductSource,
    product: any,
    editedOverrides: EditedFoodOverrides | null,
    fallbackBarcode?: string
  ): any {
    if (!editedOverrides) {
      const usda = product as USDAEditableProduct;
      return source === 'usda' && fallbackBarcode && !usda.gtinUpc
        ? { ...product, gtinUpc: fallbackBarcode }
        : product;
    }

    if (source === 'usda') {
      const usda = product as USDAEditableProduct;
      return {
        ...product,
        description: editedOverrides.name?.trim() || usda.description,
        gtinUpc: editedOverrides.barcode?.trim() || usda.gtinUpc || fallbackBarcode,
        ingredients: editedOverrides.description?.trim() || usda.ingredients,
      };
    }

    if (source === 'musclog') {
      const musclog = product as MusclogEditableProduct;
      return {
        ...product,
        name: editedOverrides.name?.trim() || getProductName(product).name,
        description: editedOverrides.description?.trim() || musclog.description,
      };
    }

    const off = product as OFFEditableProduct;
    const fallbackName = getProductName(product).name;
    return {
      ...product,
      product_name: (editedOverrides.name?.trim() || fallbackName).trim() || fallbackName,
      code: (editedOverrides.barcode?.trim() || off.code || fallbackBarcode) ?? '',
      ingredients_text: editedOverrides.description?.trim() || off.ingredients_text,
    };
  }

  private static buildNutritionPayload(
    nutrition: FoodMealTrackingActionNutrition,
    isFavorite: boolean
  ) {
    return {
      calories: nutrition.nutritionalData.calories,
      protein: nutrition.nutritionalData.protein,
      carbs: nutrition.nutritionalData.carbs,
      fat: nutrition.nutritionalData.fat,
      fiber: nutrition.nutritionalData.fiber,
      sugar: nutrition.nutritionalData.sugar,
      saturatedFat: nutrition.nutritionalData.saturatedFat,
      sodium: nutrition.nutritionalData.sodium,
      micros: nutrition.effectiveMicrosPer100g,
      isFavorite,
    };
  }

  private static extractUSDARawMicros(product: { foodNutrients?: unknown }): MicrosData {
    const nutrients = product?.foodNutrients;
    if (!Array.isArray(nutrients)) {
      return {};
    }

    return nutrients.reduce<MicrosData>((acc, nutrient: USDANutrient) => {
      const number = nutrient.nutrientNumber || nutrient.number || nutrient.nutrient?.number;
      const value = nutrient.value ?? nutrient.amount;
      const numericValue = typeof value === 'number' ? value : Number(value);

      if (number && Number.isFinite(numericValue)) {
        acc[number] = numericValue;
      }

      return acc;
    }, {});
  }

  private static extractOFFRawNutriments(product: { nutriments?: unknown }): MicrosData {
    return product?.nutriments && typeof product.nutriments === 'object'
      ? (product.nutriments as MicrosData)
      : {};
  }

  private static normalizeGrade(value: unknown): string | undefined {
    return typeof value === 'string' && value ? value.toLowerCase() : undefined;
  }

  /**
   * Logs the food and floors the action to ~100ms. The delay keeps the modal's loading state from
   * flashing on a fast write, and gives WatermelonDB's log observers a tick to propagate the new
   * entry before the host modal closes and the parent screen re-queries.
   */
  private static async logFoodAndSettle(
    foodId: string,
    selection: FoodMealTrackingActionSelection,
    loggedDateTime: Date
  ): Promise<void> {
    const MIN_SETTLE_MS = 100;
    await Promise.all([
      NutritionService.logFood(
        foodId,
        loggedDateTime,
        selection.selectedMeal,
        selection.servingSize
      ),
      new Promise((resolve) => setTimeout(resolve, MIN_SETTLE_MS)),
    ]);
  }
}
