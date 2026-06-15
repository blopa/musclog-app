import { type FoodLabels } from '@/database/models/Food';

type NumericLike = number | string | null | undefined;

type MusclogOtherNutrients = {
  sugar?: NumericLike;
  saturated_fat?: NumericLike;
  sodium?: NumericLike;
};

export type MusclogProduct = {
  name?: string;
  brand?: string;
  kcal?: NumericLike;
  calories?: NumericLike;
  protein?: NumericLike;
  carbs?: NumericLike;
  fat?: NumericLike;
  fiber?: NumericLike;
  sugar?: NumericLike;
  saturatedFat?: NumericLike;
  sodium?: NumericLike;
  other_nutrients?: MusclogOtherNutrients;
  nutriscore?: string | null;
  novagroup?: string | null;
  organic?: boolean;
  vegan?: boolean;
  vegetarian?: boolean;
  palmOilFree?: boolean;
  fairTrade?: boolean;
};

export type MusclogNutritionPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  sodium: number;
};

function parseMusclogNumber(value: NumericLike): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getMusclogQualityScores(product: MusclogProduct): {
  nutriscore: string | undefined;
  novaGroup: number | undefined;
  labels: FoodLabels | undefined;
} {
  const nutriscore =
    product.nutriscore != null && product.nutriscore !== ''
      ? product.nutriscore.toLowerCase()
      : undefined;

  let novaGroup: number | undefined;
  if (product.novagroup != null && product.novagroup !== '') {
    const parsed = parseInt(String(product.novagroup), 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 4) {
      novaGroup = parsed;
    }
  }

  const labelFields: FoodLabels = {};
  if (product.organic != null) {
    labelFields.organic = product.organic;
  }

  if (product.vegan != null) {
    labelFields.vegan = product.vegan;
  }

  if (product.vegetarian != null) {
    labelFields.vegetarian = product.vegetarian;
  }

  if (product.palmOilFree != null) {
    labelFields.palmOilFree = product.palmOilFree;
  }

  if (product.fairTrade != null) {
    labelFields.fairTrade = product.fairTrade;
  }

  const labels = Object.keys(labelFields).length > 0 ? labelFields : undefined;

  return { nutriscore, novaGroup, labels };
}

export function getMusclogNutritionPer100g(product: MusclogProduct): MusclogNutritionPer100g {
  return {
    calories: parseMusclogNumber(product.kcal ?? product.calories),
    protein: parseMusclogNumber(product.protein),
    carbs: parseMusclogNumber(product.carbs),
    fat: parseMusclogNumber(product.fat),
    fiber: parseMusclogNumber(product.fiber),
    sugar: parseMusclogNumber(product.other_nutrients?.sugar ?? product.sugar),
    saturatedFat: parseMusclogNumber(
      product.other_nutrients?.saturated_fat ?? product.saturatedFat
    ),
    sodium: parseMusclogNumber(product.other_nutrients?.sodium ?? product.sodium),
  };
}
