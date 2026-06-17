import type { ProductDetailsQueryData } from '@/hooks/useFoodProductDetails';
import { isSuccessFoodDetailProductState } from '@/types/guards/openFoodFacts';
import { toFiniteMacro } from '@/utils/inferCaloriesFromMacros';
import { getMusclogNutritionPer100g } from '@/utils/musclogProduct';
import {
  getNutrimentsFromV3Nutrition,
  getNutrimentsWithFallback,
  getNutrimentValue,
} from '@/utils/openFoodFactsMapper';
import { mapUSDANutritient } from '@/utils/usdaMapper';

export function inferBarcodeNutritionSource(
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

  const product = state.product;
  const src = (state as any).source;

  if (src === 'musclog') {
    const nutrition = getMusclogNutritionPer100g(product as any);
    return {
      calories: toFiniteMacro(nutrition.calories),
      protein: toFiniteMacro(nutrition.protein),
      carbs: toFiniteMacro(nutrition.carbs),
      fat: toFiniteMacro(nutrition.fat),
      fiber: toFiniteMacro(nutrition.fiber),
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
      fiber: toFiniteMacro(
        (mapUSDANutritient(nutrients, '1079') ?? mapUSDANutritient(nutrients, '291') ?? 0) *
          normFactor
      ),
    };
  }

  const nutrients = getNutrimentsWithFallback(product) || getNutrimentsFromV3Nutrition(product);
  if (!nutrients) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  }

  const offKeys = {
    calories: 'energy-kcal',
    protein: 'proteins',
    carbs: 'carbohydrates',
    fat: 'fat',
  } as const;
  const getNum = (key: keyof typeof offKeys) =>
    toFiniteMacro((getNutrimentValue(nutrients, offKeys[key]) ?? 0) as number);

  const directFiber = getNutrimentValue(nutrients, 'fiber');
  let fiber: number;
  if (directFiber !== undefined && directFiber >= 0) {
    fiber = directFiber;
  } else {
    const carbsTotal = getNutrimentValue(nutrients, 'carbohydrates-total');
    const carbs = getNutrimentValue(nutrients, 'carbohydrates');
    fiber = carbsTotal !== undefined && carbs !== undefined ? Math.max(0, carbsTotal - carbs) : 0;
  }

  return {
    calories: getNum('calories'),
    protein: getNum('protein'),
    carbs: getNum('carbs'),
    fat: getNum('fat'),
    fiber: toFiniteMacro(fiber),
  };
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
