import type { MealType } from '@/database/models/NutritionLog';

import { NOT_WRITTEN, type NutritionHealthWriteResult } from './nutritionHealthTypes';

export interface NutritionWriteParams {
  externalId?: string;
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
): Promise<NutritionHealthWriteResult> {
  return NOT_WRITTEN;
}

export async function deleteNutritionLogsFromHealthConnect(_externalIds: string[]): Promise<void> {}

export async function syncNutritionFromHealthConnect(
  _timeRange?: { startTime: number; endTime: number },
  _options?: { retryAttempts?: number; reportErrors?: boolean }
): Promise<NutritionSyncCounts> {
  return { totalRead: 0, written: 0, updated: 0, deleted: 0, skipped: 0 };
}
