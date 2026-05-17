import type { FoodLabels } from '@/database/models/Food';

export type NutritionQuality = {
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
];

export function hasNutritionQualityData({
  nutriScore,
  ecoScore,
  novaGroup,
  labels,
}: NutritionQuality): boolean {
  const hasScores = !!nutriScore || !!ecoScore;
  const hasLabels = LABEL_KEYS.some(({ key }) => labels?.[key] === true);
  return hasScores || novaGroup != null || hasLabels;
}
