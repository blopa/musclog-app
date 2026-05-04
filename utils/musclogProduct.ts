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
