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

type ExternalProductForSave = {
  source: ExternalFoodProductSource;
  product: any;
};

type USDANutrient = {
  nutrientNumber?: string;
  number?: string;
  nutrient?: { number?: string };
  value?: unknown;
  amount?: unknown;
};

export class FoodMealTrackingActionService {
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
      if (editedOverrides.name != null) {
        patch.name = editedOverrides.name;
      }

      if (editedOverrides.barcode != null) {
        patch.barcode = editedOverrides.barcode;
      }

      if (editedOverrides.description != null) {
        patch.description = editedOverrides.description;
      }

      if (editedOverrides.calories != null) {
        patch.calories = editedOverrides.calories;
      }

      if (editedOverrides.protein != null) {
        patch.protein = editedOverrides.protein;
      }

      if (editedOverrides.carbs != null) {
        patch.carbs = editedOverrides.carbs;
      }

      if (editedOverrides.fat != null) {
        patch.fat = editedOverrides.fat;
      }

      if (editedOverrides.fiber != null) {
        patch.fiber = editedOverrides.fiber;
      }

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

  private static applyEditedOverridesToExternalProduct(
    source: ExternalFoodProductSource,
    product: any,
    editedOverrides: EditedFoodOverrides | null,
    fallbackBarcode?: string
  ): any {
    if (!editedOverrides) {
      return source === 'usda' && fallbackBarcode && !product.gtinUpc
        ? { ...product, gtinUpc: fallbackBarcode }
        : product;
    }

    if (source === 'usda') {
      return {
        ...product,
        description: editedOverrides.name?.trim() || product.description,
        gtinUpc: editedOverrides.barcode?.trim() || product.gtinUpc || fallbackBarcode,
        ingredients: editedOverrides.description?.trim() || product.ingredients,
      };
    }

    if (source === 'musclog') {
      return {
        ...product,
        name: editedOverrides.name?.trim() || getProductName(product).name,
        description: editedOverrides.description?.trim() || product.description,
      };
    }

    const codeFromProduct = (product as { code?: string }).code;
    const fallbackName = getProductName(product).name;
    return {
      ...product,
      product_name: (editedOverrides.name?.trim() || fallbackName).trim() || fallbackName,
      code: (editedOverrides.barcode?.trim() || codeFromProduct || fallbackBarcode) ?? '',
      ingredients_text: editedOverrides.description?.trim() || product.ingredients_text,
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

  private static extractUSDARawMicros(product: any): MicrosData {
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

  private static extractOFFRawNutriments(product: any): MicrosData {
    return product?.nutriments && typeof product.nutriments === 'object'
      ? (product.nutriments as MicrosData)
      : {};
  }

  private static normalizeGrade(value: unknown): string | undefined {
    return typeof value === 'string' && value ? value.toLowerCase() : undefined;
  }

  private static async logFoodAndSettle(
    foodId: string,
    selection: FoodMealTrackingActionSelection,
    loggedDateTime: Date
  ): Promise<void> {
    await Promise.all([
      NutritionService.logFood(
        foodId,
        loggedDateTime,
        selection.selectedMeal,
        selection.servingSize
      ),
      new Promise((resolve) => setTimeout(resolve, 100)),
    ]);
  }
}
