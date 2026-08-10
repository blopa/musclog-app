/**
 * Builds a `food` share: one food, the portions linked to it, and optionally its photo.
 *
 * The same food graph a meal share carries per ingredient, rooted at the food instead of reached
 * through it — so a food that arrives on its own and the same food that arrives inside a meal
 * dedupe against exactly the same rows on the receiver.
 */

import { database } from '@/database/database-instance';
import type Food from '@/database/models/Food';
import type FoodFoodPortion from '@/database/models/FoodFoodPortion';
import type FoodPortion from '@/database/models/FoodPortion';
import {
  OPTICAL_EXPORT_VERSION_SHARE,
  OPTICAL_PAYLOAD_KIND_SHARE,
} from '@/utils/optical/container';
import {
  type FoodShareEnvelope,
  type FoodSharePortion,
  MUSCLOG_SHARE_ENVELOPE_VERSION,
} from '@/utils/share/shareEnvelope';
import { FOOD_SHARE_SPEC } from '@/utils/share/shareKinds';

import {
  applyShareImage,
  isActive,
  optionalNumber,
  prepareShareImage,
  shareRow,
} from './shareRecords';

export interface BuildFoodShareOptions {
  includeImage: boolean;
}

/**
 * A portion is carried only when it belongs to nobody or to this food. A portion owned by some
 * other record has no owner in this envelope to point at, and `FOOD_SHARE_SPEC` deliberately
 * discriminates `owner_id` to `foods` alone — carrying one would fail the import on a foreign key
 * that cannot resolve.
 */
function isCarriablePortion(portion: FoodPortion, foodId: string): boolean {
  return !portion.ownerType || (portion.ownerType === 'food' && portion.ownerId === foodId);
}

export async function buildFoodShareEnvelope(
  foodId: string,
  options: BuildFoodShareOptions
): Promise<FoodShareEnvelope> {
  const food = await database.get<Food>('foods').find(foodId);
  if (!isActive(food)) {
    throw new Error('Food not found');
  }

  const links = await food.foodPortions.fetch();
  const resolved = await Promise.all(
    links.map(async (link) => {
      if (!isActive(link)) {
        return undefined;
      }
      try {
        const portion = await link.foodPortion;
        return isActive(portion) && isCarriablePortion(portion, food.id)
          ? { link, portion }
          : undefined;
      } catch {
        // A broken portion link does not make the food itself unshareable.
        return undefined;
      }
    })
  );

  const portionLinks: FoodFoodPortion[] = [];
  const portions = new Map<string, FoodPortion>();
  const summaryPortions: FoodSharePortion[] = [];
  for (const entry of resolved) {
    if (!entry) {
      continue;
    }
    portionLinks.push(entry.link);
    portions.set(entry.portion.id, entry.portion);
    summaryPortions.push({
      gramWeight: optionalNumber(entry.portion.gramWeight),
      isDefault: Boolean(entry.link.isDefault),
      name: entry.portion.name,
    });
  }

  const foodRow = shareRow(food);
  const image = await prepareShareImage(food.imageUrl, 'foodImage', options.includeImage);
  applyShareImage(foodRow, 'image_url', image);

  return {
    _musclogShare: MUSCLOG_SHARE_ENVELOPE_VERSION,
    ...(image.asset ? { assets: { foodImage: image.asset } } : undefined),
    createdAtMs: Date.now(),
    kind: 'food',
    kindVersion: FOOD_SHARE_SPEC.kindVersion,
    records: {
      food_food_portions: portionLinks.map(shareRow),
      food_portions: [...portions.values()].map(shareRow),
      foods: [foodRow],
    },
    rootId: food.id,
    rootTable: FOOD_SHARE_SPEC.rootTable,
    summary: {
      brand: food.brand || undefined,
      description: food.description || undefined,
      // The value, not the asset: a remote photo rides along as a URL and embeds nothing.
      hasImage: Boolean(image.value),
      name: food.name,
      nutrients: {
        calories: food.calories,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        protein: food.protein,
      },
      nutritionBasis: food.resolvedNutritionBasis,
      portions: summaryPortions,
    },
  };
}

export async function buildFoodSharePayload(foodId: string, options: BuildFoodShareOptions) {
  const envelope = await buildFoodShareEnvelope(foodId, options);
  return {
    exportVersion: OPTICAL_EXPORT_VERSION_SHARE,
    json: JSON.stringify(envelope),
    payloadKind: OPTICAL_PAYLOAD_KIND_SHARE,
  };
}
