import type { MicrosData } from '@/database/models';
import { isSuccessFoodDetailProductState } from '@/types/guards/openFoodFacts';
import type { ProductState } from '@/types/openFoodFacts';
import { totalCarbsForFoodSource } from '@/utils/carbsConvention';
import { toFiniteMacro } from '@/utils/inferCaloriesFromMacros';
import { getMusclogNutritionPer100g } from '@/utils/musclogProduct';
import {
  getNutrimentsWithFallback,
  getNutrimentValue,
  type OpenFoodFactsNutritionProduct,
  parseOpenFoodFactsNutritionPer100g,
} from '@/utils/openFoodFactsMapper';
import { mapUSDANutritient } from '@/utils/usdaMapper';

export type ExternalFoodProductSource = 'openfood' | 'usda' | 'musclog';
export type BarcodeNutritionSource = ExternalFoodProductSource | null;

export type ProductDetailsQueryData =
  | ProductState
  | { status: 'success'; source: 'usda' | 'musclog'; product: any }
  | { status: 'error'; error: { message: string } }
  | null;

export function inferBarcodeNutritionSource(
  details: ProductDetailsQueryData | null | undefined,
  productFromSearch: any
): BarcodeNutritionSource {
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

/**
 * Resolves the concrete external source for a product on the **save** path, where a product must be
 * written under some source. Unlike {@link inferBarcodeNutritionSource} this never returns null: it
 * extends the inference with a product-shape fallback (USDA `fdcId`, explicit `source` tags) and
 * defaults to `'openfood'`. Single source of truth for source detection across the food-details
 * modals and {@link parseCoreMacrosFromAlternateSource}.
 */
export function resolveExternalFoodSource(
  details: ProductDetailsQueryData | null | undefined,
  productFromSearch: any
): ExternalFoodProductSource {
  const inferred = inferBarcodeNutritionSource(details, productFromSearch);
  if (inferred) {
    return inferred;
  }

  const product = (details as any)?.product ?? productFromSearch;
  if (product?.source === 'usda' || product?.fdcId) {
    return 'usda';
  }

  if (product?.source === 'musclog') {
    return 'musclog';
  }

  return 'openfood';
}

export function getProductBarcodeFromSearchProduct(productFromSearch: unknown): string {
  if (!productFromSearch || typeof productFromSearch !== 'object') {
    return '';
  }

  const product = productFromSearch as { code?: string; gtinUpc?: string };
  return product.code ?? product.gtinUpc ?? '';
}

export function parseServingSizeFromProduct(product: any): number | undefined {
  if (!product) {
    return undefined;
  }

  const usdaServingSizeStr =
    product.servingSize != null ? `${product.servingSize}${product.servingSizeUnit || 'g'}` : null;

  const servingStr = product.serving_size ?? usdaServingSizeStr;

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
}

/** Per-100g nutrition extracted from an external product (core macros + the tracked micros). */
export type ProductNutritionPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  sodium: number;
  alcohol: number;
  potassium: number;
  magnesium: number;
  zinc: number;
};

// Deliberately distinct from openFoodFactsMapper's EMPTY_OPEN_FOOD_FACTS_NUTRITION: this shape
// (ProductNutritionPer100g) is the cross-source product shape and omits `salt`. Do not "dedupe" them.
export const EMPTY_PRODUCT_NUTRITION: ProductNutritionPer100g = {
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

function parseMusclogNutritionPer100g(product: any): ProductNutritionPer100g {
  const n = getMusclogNutritionPer100g(product);
  return {
    ...EMPTY_PRODUCT_NUTRITION,
    calories: toFiniteMacro(n.calories),
    protein: toFiniteMacro(n.protein),
    carbs: toFiniteMacro(n.carbs),
    fat: toFiniteMacro(n.fat),
    fiber: toFiniteMacro(n.fiber),
    sugar: toFiniteMacro(n.sugar),
    saturatedFat: toFiniteMacro(n.saturatedFat),
    sodium: toFiniteMacro(n.sodium),
  };
}

function parseUSDANutritionPer100g(product: any): ProductNutritionPer100g {
  const nutrients = (product?.foodNutrients as any[]) ?? undefined;
  // USDA Branded foods report nutrients per serving, not per 100g. Normalize to per-100g so the
  // caller's scaleFactor (servingSize / 100) produces correct values.
  const rawServingSize = product?.servingSize;
  const isBranded = product?.dataType === 'Branded';
  const normFactor = isBranded && rawServingSize && rawServingSize > 0 ? 100 / rawServingSize : 1;

  const pick = (...numbers: string[]): number => {
    for (const num of numbers) {
      const value = mapUSDANutritient(nutrients, num);
      if (value != null) {
        return value;
      }
    }

    return 0;
  };
  const macro = (...numbers: string[]) => toFiniteMacro(pick(...numbers) * normFactor);
  // Minerals are reported in MG by USDA; convert to grams for storage.
  const mineralGrams = (...numbers: string[]) =>
    toFiniteMacro((pick(...numbers) / 1000) * normFactor);

  // USDA nutrient 1005 already includes fiber (= canonical total carbs).
  const carbs = macro('1005', '205');
  const fiber = macro('1079', '291');

  return {
    calories: macro('1008', '208', 'ENERC_KCAL'),
    protein: macro('1003', '203'),
    carbs: totalCarbsForFoodSource('usda', { carbs, fiber }),
    fat: macro('1004', '204'),
    fiber,
    sugar: macro('2000', '269', 'sugars'),
    saturatedFat: macro('1258', '606'),
    sodium: mineralGrams('1093', '307'),
    alcohol: macro('1018', '221'),
    potassium: mineralGrams('1092', '306'),
    magnesium: mineralGrams('1090', '304'),
    zinc: mineralGrams('1095', '309'),
  };
}

function parseOFFNutritionPer100g(product: OpenFoodFactsNutritionProduct): ProductNutritionPer100g {
  const { nutrition } = parseOpenFoodFactsNutritionPer100g(product);
  return {
    ...EMPTY_PRODUCT_NUTRITION,
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    fiber: nutrition.fiber,
    sugar: nutrition.sugar,
    saturatedFat: nutrition.saturatedFat,
    sodium: nutrition.sodium,
    alcohol: nutrition.alcohol,
    potassium: nutrition.potassium,
    magnesium: nutrition.magnesium,
    zinc: nutrition.zinc,
  };
}

/**
 * Parses source-less nutriment blobs that are already in the app's food convention.
 * Used for synthetic AI-label products, not external catalog ingestion.
 */
export function parsePlainNutrimentsNutritionPer100g(
  product: OpenFoodFactsNutritionProduct
): ProductNutritionPer100g | null {
  const nutrients = getNutrimentsWithFallback(product);
  if (!nutrients) {
    return null;
  }

  const num = (key: string) => toFiniteMacro(getNutrimentValue(nutrients, key) ?? 0);
  const directFiber = getNutrimentValue(nutrients, 'fiber');
  const carbsTotal = getNutrimentValue(nutrients, 'carbohydrates-total');
  const carbs = getNutrimentValue(nutrients, 'carbohydrates');
  // TODO: use helper function instead of nested ternary
  const fiber =
    directFiber !== undefined
      ? Math.max(0, directFiber)
      : carbsTotal !== undefined && carbs !== undefined
        ? Math.max(0, carbsTotal - carbs)
        : 0;

  return {
    ...EMPTY_PRODUCT_NUTRITION,
    calories: num('energy-kcal') || num('kcal'),
    protein: num('proteins'),
    carbs: num('carbohydrates'),
    fat: num('fat'),
    fiber,
    sugar: num('sugars'),
    saturatedFat: num('saturated-fat'),
    sodium: toFiniteMacro(
      getNutrimentValue(nutrients, 'sodium') ?? getNutrimentValue(nutrients, 'salt') ?? 0
    ),
    alcohol: num('alcohol'),
    potassium: num('potassium'),
    magnesium: num('magnesium'),
    zinc: num('zinc'),
  };
}

/**
 * Canonical per-source → per-100g nutrition extraction for external catalog products
 * (musclog / USDA / Open Food Facts). Single source of truth shared by the food-details modals
 * and {@link parseCoreMacrosFromAlternateSource}.
 */
export function parseProductNutritionPer100g(
  source: ExternalFoodProductSource,
  product: any
): ProductNutritionPer100g {
  if (source === 'musclog') {
    return parseMusclogNutritionPer100g(product);
  }

  if (source === 'usda') {
    return parseUSDANutritionPer100g(product);
  }

  return parseOFFNutritionPer100g(product);
}

/** Picks the tracked micros out of a parsed nutrition object, skipping non-finite / zero trace values. */
export function microsFromNutrition(n: Partial<ProductNutritionPer100g>): MicrosData {
  const out: MicrosData = {};
  if (typeof n.sugar === 'number' && Number.isFinite(n.sugar)) {
    out.sugar = n.sugar;
  }

  if (typeof n.saturatedFat === 'number' && Number.isFinite(n.saturatedFat)) {
    out.saturatedFat = n.saturatedFat;
  }

  if (typeof n.sodium === 'number' && Number.isFinite(n.sodium)) {
    out.sodium = n.sodium;
  }

  if (typeof n.alcohol === 'number' && Number.isFinite(n.alcohol) && n.alcohol > 0) {
    out.alcohol = n.alcohol;
  }

  if (typeof n.potassium === 'number' && Number.isFinite(n.potassium) && n.potassium > 0) {
    out.potassium = n.potassium;
  }

  if (typeof n.magnesium === 'number' && Number.isFinite(n.magnesium) && n.magnesium > 0) {
    out.magnesium = n.magnesium;
  }

  if (typeof n.zinc === 'number' && Number.isFinite(n.zinc) && n.zinc > 0) {
    out.zinc = n.zinc;
  }

  return out;
}

export function parseCoreMacrosFromAlternateSource(state: ProductDetailsQueryData): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
} | null {
  if (!isSuccessFoodDetailProductState(state)) {
    return null;
  }

  const source = resolveExternalFoodSource(state, null);
  const { calories, protein, carbs, fat, fiber } = parseProductNutritionPer100g(
    source,
    state.product
  );

  return { calories, protein, carbs, fat, fiber };
}

/** True when all of the core macros (calories, protein, carbs, fat, fiber) are effectively zero. */
export function areCoreMacrosEffectivelyZero(data: {
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
