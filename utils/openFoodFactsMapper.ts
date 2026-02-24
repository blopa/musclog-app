import { UnifiedFoodResult } from '../hooks/useUnifiedFoodSearch';
import { SearchResultProduct } from '../types/openFoodFacts';

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
  // Additional properties found in examples
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

// Helper function to extract nutriment value with fallback hierarchy
function getNutrimentValue(nutriments: any, baseName: string): number | undefined {
  // Priority order: _100g > _serving > base name > _value
  const value100g = nutriments[`${baseName}_100g`];
  const valueServing = nutriments[`${baseName}_serving`];
  const baseValue = nutriments[baseName];
  const valueField = nutriments[`${baseName}_value`];

  return value100g ?? valueServing ?? baseValue ?? valueField;
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
  const kcal = product.nutriments?.['energy-kcal'];
  const calories = kcal ? Math.round(kcal) : undefined;

  // Map all comprehensive nutriments
  const allNutriments = mapAllNutriments(product.nutriments);

  // Extract key macronutrients with proper fallback
  const protein = getNutrimentValue(product.nutriments, 'proteins');
  const carbs = getNutrimentValue(product.nutriments, 'carbohydrates');
  const fat = getNutrimentValue(product.nutriments, 'fat');
  const fiber = getNutrimentValue(product.nutriments, 'fiber') || 0;
  const sugars = getNutrimentValue(product.nutriments, 'sugars');
  const saturatedFat = getNutrimentValue(product.nutriments, 'saturated-fat');
  const sodium = getNutrimentValue(product.nutriments, 'sodium');
  const salt = getNutrimentValue(product.nutriments, 'salt');

  // Extract vitamins and minerals
  const vitaminA = getNutrimentValue(product.nutriments, 'vitamin-a');
  const vitaminC = getNutrimentValue(product.nutriments, 'vitamin-c');
  const vitaminE = getNutrimentValue(product.nutriments, 'vitamin-e');
  const vitaminK = getNutrimentValue(product.nutriments, 'vitamin-k');
  const calcium = getNutrimentValue(product.nutriments, 'calcium');
  const iron = getNutrimentValue(product.nutriments, 'iron');
  const magnesium = getNutrimentValue(product.nutriments, 'magnesium');
  const potassium = getNutrimentValue(product.nutriments, 'potassium');
  const zinc = getNutrimentValue(product.nutriments, 'zinc');

  // Extract other compounds
  const cholesterol = getNutrimentValue(product.nutriments, 'cholesterol');
  const caffeine = getNutrimentValue(product.nutriments, 'caffeine');
  const alcohol = getNutrimentValue(product.nutriments, 'alcohol');

  // Extract additional fats
  const transFat = getNutrimentValue(product.nutriments, 'trans-fat');
  const polyunsaturatedFat = getNutrimentValue(product.nutriments, 'polyunsaturated-fat');
  const monounsaturatedFat = getNutrimentValue(product.nutriments, 'monounsaturated-fat');

  // Extract nutrition scores
  const nutritionScoreFr = getNutrimentValue(product.nutriments, 'nutrition-score-fr');
  const nutritionScoreUk = getNutrimentValue(product.nutriments, 'nutrition-score-uk');

  // Extract ingredient estimates
  const fruitsVegetablesNutsEstimate = getNutrimentValue(
    product.nutriments,
    'fruits-vegetables-nuts-estimate-from-ingredients'
  );
  const fruitsVegetablesLegumesEstimate = getNutrimentValue(
    product.nutriments,
    'fruits-vegetables-legumes-estimate-from-ingredients'
  );

  // Extract environmental data
  const carbonFootprint = getNutrimentValue(
    product.nutriments,
    'carbon-footprint-from-known-ingredients'
  );

  return {
    id: product.code || String(Math.random()),
    name: product.product_name || 'Unknown Product',
    description: `${product.brands || product.generic_name || 'Generic'} • ${calories ? `${calories} kcal` : 'N/A'}`,
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

// Export the properties array for reference
export { NUTRIMENT_PROPERTIES };
