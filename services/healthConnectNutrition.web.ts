import type { MealType } from '@/database/models/NutritionLog';

export interface NutritionWriteParams {
  logId: string;
  date: number;
  mealType: MealType;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface NutritionSyncCounts {
  totalRead: number;
  written: number;
  updated: number;
  deleted: number;
  skipped: number;
}

export async function writeNutritionLogToHealthConnect(
  _params: NutritionWriteParams
): Promise<string | undefined> {
  return undefined;
}

export async function syncNutritionFromHealthConnect(
  _timeRange?: { startTime: number; endTime: number },
  _options?: { retryAttempts?: number }
): Promise<NutritionSyncCounts> {
  return { totalRead: 0, written: 0, updated: 0, deleted: 0, skipped: 0 };
}
