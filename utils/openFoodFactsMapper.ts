import { UnifiedFoodResult } from '../hooks/useUnifiedFoodSearch';
import i18n from '../lang/lang';
import {
  ProductNameFields,
  ProductV3,
  SearchResultProduct,
  SuccessFoodProductState,
} from '../types/openFoodFacts';

// All possible Open Food Facts nutriment properties
const NUTRIMENT_PROPERTIES = [
  'carbohydrates',
  'carbohydrates_100g',
  'carbohydrates_serving',
  'carbohydrates_unit',
  'carbohydrates_value',
  'energy',
  'energy-kcal',
  'energy-kcal_100g',
  'energy-kcal_serving',
  'energy-kcal_unit',
  'energy-kcal_value',
  'energy-kj',
  'energy-kj_100g',
  'energy-kj_serving',
  'energy-kj_unit',
  'energy-kj_value',
  'energy_100g',
  'energy_serving',
  'energy_unit',
  'energy_value',
  'fat',
  'fat_100g',
  'fat_serving',
  'fat_unit',
  'fat_value',
  'fiber',
  'fiber_100g',
  'fiber_serving',
  'fiber_unit',
  'fiber_value',
  'nova-group',
  'nova-group_100g',
  'nova-group_serving',
  'nova-group_unit',
  'nova-group_value',
  'proteins',
  'proteins_100g',
  'proteins_serving',
  'proteins_unit',
  'proteins_value',
  'salt',
  'salt_100g',
  'salt_serving',
  'salt_unit',
  'salt_value',
  'saturated-fat',
  'saturated-fat_100g',
  'saturated-fat_serving',
  'saturated-fat_unit',
  'saturated-fat_value',
  'sodium',
  'sodium_100g',
  'sodium_serving',
  'sodium_unit',
  'sodium_value',
  'sugars',
  'sugars_100g',
  'sugars_serving',
  'sugars_unit',
  'sugars_value',
  'alcohol',
  'alcohol_100g',
  'alcohol_serving',
  'alcohol_unit',
  'alcohol_value',
  'cerotic-acid',
  'cerotic-acid_100g',
  'cerotic-acid_serving',
  'cerotic-acid_unit',
  'cerotic-acid_value',
  'choline',
  'choline_100g',
  'choline_serving',
  'choline_unit',
  'choline_value',
  'starch',
  'starch_100g',
  'starch_serving',
  'starch_unit',
  'starch_value',
  'added-sugars',
  'added-sugars_100g',
  'added-sugars_unit',
  'added-sugars_value',
  'caffeine',
  'caffeine_100g',
  'caffeine_unit',
  'caffeine_value',
  'copper',
  'copper_100g',
  'copper_unit',
  'copper_value',
  'iron',
  'iron_100g',
  'iron_unit',
  'iron_value',
  'magnesium',
  'magnesium_100g',
  'magnesium_unit',
  'magnesium_value',
  'manganese',
  'manganese_100g',
  'manganese_unit',
  'manganese_value',
  'phosphorus',
  'phosphorus_100g',
  'phosphorus_unit',
  'phosphorus_value',
  'selenium',
  'selenium_100g',
  'selenium_unit',
  'selenium_value',
  'vitamin-a',
  'vitamin-a_100g',
  'vitamin-a_unit',
  'vitamin-a_value',
  'vitamin-c',
  'vitamin-c_100g',
  'vitamin-c_unit',
  'vitamin-c_value',
  'vitamin-e',
  'vitamin-e_100g',
  'vitamin-e_unit',
  'vitamin-e_value',
  'vitamin-k',
  'vitamin-k_100g',
  'vitamin-k_unit',
  'vitamin-k_value',
  'zinc',
  'zinc_100g',
  'zinc_unit',
  'zinc_value',
  'calcium',
  'calcium_100g',
  'calcium_serving',
  'calcium_unit',
  'calcium_value',
  'cholesterol',
  'cholesterol_100g',
  'cholesterol_serving',
  'cholesterol_unit',
  'cholesterol_value',
  'iron_serving',
  'potassium',
  'potassium_100g',
  'potassium_serving',
  'potassium_unit',
  'potassium_value',
  'added-sugars_serving',
  'caffeine_serving',
  'copper_serving',
  'magnesium_serving',
  'manganese_serving',
  'phosphorus_serving',
  'selenium_serving',
  'vitamin-a_serving',
  'vitamin-c_serving',
  'vitamin-e_serving',
  'vitamin-k_serving',
  'zinc_serving',
  'trans-fat',
  'trans-fat_100g',
  'trans-fat_serving',
  'trans-fat_unit',
  'trans-fat_value',
  'polyunsaturated-fat_100g',
  'monounsaturated-fat_100g',
  'nutrition-score-fr',
  'nutrition-score-fr_100g',
  'nutrition-score-fr_serving',
  'nutrition-score-uk',
  'nutrition-score-uk_100g',
  'nutrition-score-uk_serving',
  'iron_label',
  'calcium_label',
  'vitamin-a_label',
  'vitamin-c_label',
  'trans-fat_label',
  'fruits-vegetables-nuts-estimate-from-ingredients_100g',
  'fruits-vegetables-nuts-estimate-from-ingredients_serving',
  'fruits-vegetables-legumes-estimate-from-ingredients_100g',
  'fruits-vegetables-legumes-estimate-from-ingredients_serving',
  'carbon-footprint-from-known-ingredients_100g',
  'carbon-footprint-from-known-ingredients_product',
  'energy-kj_value_computed',
];

type NutrimentsWithEstimated = SuccessFoodProductState['product']['nutriments'] & {
  isEstimated: boolean;
};

// Helper function to get nutriments with fallback to nutriments_estimated
export function getNutrimentsWithFallback(
  product: SuccessFoodProductState['product'] | SearchResultProduct
): NutrimentsWithEstimated | null {
  if (!product?.nutriments && !product?.nutriments_estimated) {
    const v3 = getNutrimentsFromV3Nutrition(product);
    return v3 ? (v3 as NutrimentsWithEstimated) : null;
  }

  const estimated =
    product?.nutriments_estimated && typeof product.nutriments_estimated === 'object'
      ? product.nutriments_estimated
      : {};

  const nutriments =
    product?.nutriments && typeof product.nutriments === 'object' ? product.nutriments : {};

  return {
    ...nutriments, // Priority: actual measured values
    ...estimated, // Fallback: estimated values only if real ones missing
    isEstimated: !!(product?.nutriments_estimated && !product?.nutriments),
  } as NutrimentsWithEstimated;
}

/** Read numeric value from OFF v3 nutrient (e.g. { value: 123 } or { value_per_100g: 123 }). */
function v3NutrientValue(n: unknown): number {
  if (n == null) {
    return 0;
  }

  const v =
    (n as { value?: number; value_per_100g?: number }).value ??
    (n as { value_per_100g?: number }).value_per_100g;

  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

/** Get flat nutriments from OFF v3 product.nutrition (aggregated_set or first input_set). */
export function getNutrimentsFromV3Nutrition(product: any): Record<string, number> | null {
  const set = product?.nutrition?.aggregated_set ?? product?.nutrition?.input_sets?.[0];
  if (!set) {
    return null;
  }

  const result: Record<string, number> = {
    'energy-kcal': v3NutrientValue(set['energy-kcal']),
    proteins: v3NutrientValue(set.proteins),
    carbohydrates: v3NutrientValue(set.carbohydrates),
    fat: v3NutrientValue(set.fat),
    'carbohydrates-total': v3NutrientValue(set['carbohydrates-total']),
    sugars: v3NutrientValue(set.sugars),
    'saturated-fat': v3NutrientValue(set['saturated-fat']),
    sodium: v3NutrientValue(set.sodium),
    salt: v3NutrientValue(set.salt),
  };

  // Add all other nutriments from NUTRIMENT_PROPERTIES that aren't already included
  const baseNutriments = [
    'energy-kcal',
    'proteins',
    'carbohydrates',
    'fat',
    'carbohydrates-total',
    'sugars',
    'saturated-fat',
    'sodium',
    'salt',
  ];

  NUTRIMENT_PROPERTIES.forEach((prop) => {
    // Skip the ones already added and skip unit/label properties
    if (!baseNutriments.includes(prop) && !prop.includes('_unit') && !prop.includes('_label')) {
      result[prop] = v3NutrientValue(set[prop]);
    }
  });

  return result;
}

// Helper function to extract nutriment value with fallback hierarchy (exported for use in modals)
export function getNutrimentValue(nutriments: any, baseName: string): number | undefined {
  // Priority order: _100g > _serving > base name > _value
  const value100g = nutriments[`${baseName}_100g`];
  const valueServing = nutriments[`${baseName}_serving`];
  const baseValue = nutriments[baseName];
  const valueField = nutriments[`${baseName}_value`];

  const raw = value100g ?? valueServing ?? baseValue ?? valueField;
  const num = typeof raw === 'number' && !Number.isNaN(raw) ? raw : undefined;
  return num;
}

// Helper function to get nutriment unit
function getNutrimentUnit(nutriments: any, baseName: string): string | undefined {
  return nutriments[`${baseName}_unit`];
}

// Map all nutriments to a comprehensive object
function mapAllNutriments(nutriments: any): Record<string, any> {
  if (!nutriments) {
    return {};
  }

  const mappedNutriments: Record<string, any> = {};

  // Extract all available nutriments using the properties array
  NUTRIMENT_PROPERTIES.forEach((prop) => {
    if (nutriments[prop] !== undefined) {
      mappedNutriments[prop] = nutriments[prop];
    }
  });

  return mappedNutriments;
}

// Main function to convert Open Food Facts product to UnifiedFoodResult
export function mapOpenFoodFactsProduct(product: SearchResultProduct): UnifiedFoodResult {
  const nutriments = getNutrimentsWithFallback(product);
  const kcal = nutriments?.['energy-kcal'];
  const calories = kcal ? Math.round(kcal) : undefined;

  // Map all comprehensive nutriments
  const allNutriments = mapAllNutriments(nutriments);

  // Extract key macronutrients with proper fallback
  const protein = getNutrimentValue(nutriments, 'proteins');
  const carbs = getNutrimentValue(nutriments, 'carbohydrates');
  const fat = getNutrimentValue(nutriments, 'fat');

  // Improved fiber extraction with fallback calculation and negative value protection
  const directFiber = getNutrimentValue(nutriments, 'fiber');
  let fiber = 0;

  if (directFiber !== undefined && directFiber >= 0) {
    // Use direct fiber value when available and non-negative
    fiber = directFiber;
  } else {
    // Fallback: calculate from carbohydrates-total - carbohydrates
    // Only use this if result is positive (some OFF products have inconsistent data)
    const carbsTotal = getNutrimentValue(nutriments, 'carbohydrates-total');
    if (carbsTotal !== undefined && carbs !== undefined) {
      const calculatedFiber = carbsTotal - carbs;
      fiber = Math.max(0, calculatedFiber); // Clamp to minimum 0 to prevent negative values
    }
  }

  const sugars = getNutrimentValue(nutriments, 'sugars');
  const saturatedFat = getNutrimentValue(nutriments, 'saturated-fat');
  const sodium = getNutrimentValue(nutriments, 'sodium');
  const salt = getNutrimentValue(nutriments, 'salt');

  // Extract vitamins and minerals
  const vitaminA = getNutrimentValue(nutriments, 'vitamin-a');
  const vitaminC = getNutrimentValue(nutriments, 'vitamin-c');
  const vitaminE = getNutrimentValue(nutriments, 'vitamin-e');
  const vitaminK = getNutrimentValue(nutriments, 'vitamin-k');
  const calcium = getNutrimentValue(nutriments, 'calcium');
  const iron = getNutrimentValue(nutriments, 'iron');
  const magnesium = getNutrimentValue(nutriments, 'magnesium');
  const potassium = getNutrimentValue(nutriments, 'potassium');
  const zinc = getNutrimentValue(nutriments, 'zinc');

  // Extract other compounds
  const cholesterol = getNutrimentValue(nutriments, 'cholesterol');
  const caffeine = getNutrimentValue(nutriments, 'caffeine');
  const alcohol = getNutrimentValue(nutriments, 'alcohol');

  // Extract additional fats
  const transFat = getNutrimentValue(nutriments, 'trans-fat');
  const polyunsaturatedFat = getNutrimentValue(nutriments, 'polyunsaturated-fat');
  const monounsaturatedFat = getNutrimentValue(nutriments, 'monounsaturated-fat');

  // Extract nutrition scores
  const nutritionScoreFr = getNutrimentValue(nutriments, 'nutrition-score-fr');
  const nutritionScoreUk = getNutrimentValue(nutriments, 'nutrition-score-uk');

  // Extract ingredient estimates
  const fruitsVegetablesNutsEstimate = getNutrimentValue(
    nutriments,
    'fruits-vegetables-nuts-estimate-from-ingredients'
  );
  const fruitsVegetablesLegumesEstimate = getNutrimentValue(
    nutriments,
    'fruits-vegetables-legumes-estimate-from-ingredients'
  );

  // Extract environmental data
  const carbonFootprint = getNutrimentValue(nutriments, 'carbon-footprint-from-known-ingredients');

  return {
    id: product.code || String(Math.random()),
    name: getProductName(product),
    description: calories
      ? i18n.t('food.descriptionFormat', {
          brand: product.brands || product.generic_name || i18n.t('food.generic'),
          calories,
          amount: product.serving_size || '100',
          unit: 'g',
        })
      : `${product.brands || product.generic_name || i18n.t('food.generic')} • ${i18n.t('food.notAvailable')}`,
    brand: product.brands,
    imageUrl: product.image_url,
    serving_size: product.serving_size,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    // Include comprehensive nutriments data
    nutriments: {
      ...allNutriments,
      // Structured access to common nutrients
      macronutrients: {
        protein,
        carbs,
        fat,
        fiber,
        sugars,
        saturatedFat,
        transFat,
        polyunsaturatedFat,
        monounsaturatedFat,
        alcohol,
      },
      vitamins: {
        vitaminA,
        vitaminC,
        vitaminE,
        vitaminK,
      },
      minerals: {
        calcium,
        iron,
        magnesium,
        potassium,
        zinc,
        sodium,
      },
      scores: {
        nutritionScoreFr,
        nutritionScoreUk,
      },
      estimates: {
        fruitsVegetablesNutsEstimate,
        fruitsVegetablesLegumesEstimate,
      },
      environmental: {
        carbonFootprint,
      },
      other: {
        cholesterol,
        caffeine,
        salt,
      },
    },
    source: 'api' as const,
    _raw: product,
  };
}

/**
 * All possible types passed to getProductName across the codebase:
 * - SearchResultProduct (V2 search result item)
 * - ProductV3 (V3 product, e.g. from FoodService.createFromV3Product)
 * - SuccessFoodProductState (V3 barcode-detail response with .product)
 * - Wrapper shapes from API: { product } or { products: [...] }
 */
export type GetProductNameInput =
  | SearchResultProduct
  | ProductV3
  | SuccessFoodProductState
  | { product?: SearchResultProduct | ProductV3 }
  | { products?: (SearchResultProduct | ProductV3)[] };

export function getProductName(data: GetProductNameInput | null | undefined): string {
  // OFF API: single product has .product, search has .products[], or payload is the product itself
  type WithOptional = { product?: unknown; products?: unknown[] };
  const product =
    (data as WithOptional)?.product ||
    (Array.isArray((data as WithOptional)?.products) ? (data as WithOptional).products?.[0] : data);

  if (!product) {
    return i18n.t('food.unknownFood');
  }

  const p = product as Record<string, unknown>;

  // 1. Try the standard name fields (OFF: product_name, product_name_LANG)
  let name: string | undefined =
    (p.product_name as string) ||
    (p.lang != null ? (p[`product_name_${p.lang}`] as string) : undefined) ||
    (p.product_name_en as string) ||
    (p.product_name_nl as string) ||
    (p.product_name_fr as string) ||
    (p.product_name_de as string);

  // 1b. V3 API often has only product_name_<lang> (e.g. product_name_en) without product_name – scan for any
  if (!name && typeof p === 'object' && p !== null) {
    for (const key of Object.keys(p)) {
      if (key.startsWith('product_name_') && key !== 'product_name') {
        const val = p[key];
        if (typeof val === 'string' && val.trim()) {
          name = val;
          break;
        }
      }
    }
  }

  // 2. Fallback to Abbreviated Name (OFF: abbreviated_product_name, receipt/small UI names)
  if (!name) {
    name = p.abbreviated_product_name as string;
  }

  // 3. Fallback to Generic Names (OFF: generic_name, generic_name_LANG)
  if (!name) {
    name =
      (p.generic_name as string) ||
      (p.lang != null ? (p[`generic_name_${p.lang}`] as string) : undefined) ||
      (p.generic_name_en as string);
  }

  // 4. Ultimate Fallback: Brand + Category
  // Returns something like "Milbona (Yogurts)" instead of "Unknown"
  if (!name && p.brands) {
    const category = (p.categories as string)?.split(',')[0];
    name = category ? `${p.brands} (${category})` : (p.brands as string);
  }

  return name && name.trim() ? name.trim() : i18n.t('food.unknownFood');
}

// Export the properties array for reference
export { NUTRIMENT_PROPERTIES };
