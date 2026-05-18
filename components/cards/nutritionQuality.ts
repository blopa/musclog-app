import type { FoodLabels } from '@/database/models/Food';

export type NutritionQualityScore = 'a' | 'b' | 'c' | 'd' | 'e';

export type NutritionQualityInput = {
  nutriScore?: string;
  ecoScore?: string;
  novaGroup?: number;
  labels?: FoodLabels;
};

const LABEL_KEYS: { key: keyof FoodLabels }[] = [
  { key: 'organic' },
  { key: 'vegan' },
  { key: 'vegetarian' },
  { key: 'palmOilFree' },
  { key: 'fairTrade' },
  { key: 'highProtein' },
  { key: 'highFiber' },
];

export function normalizeNutritionQualityScore(score?: string): NutritionQualityScore | undefined {
  if (typeof score !== 'string') {
    return undefined;
  }

  const normalized = score.trim().toLowerCase();
  return /^[a-e]$/.test(normalized) ? (normalized as NutritionQualityScore) : undefined;
}

export function hasNutritionQualityData({
  nutriScore,
  ecoScore,
  novaGroup,
  labels,
}: NutritionQualityInput): boolean {
  const hasScores =
    normalizeNutritionQualityScore(nutriScore) != null ||
    normalizeNutritionQualityScore(ecoScore) != null;
  const hasLabels = LABEL_KEYS.some(({ key }) => labels?.[key] === true);
  return hasScores || novaGroup != null || hasLabels;
}
