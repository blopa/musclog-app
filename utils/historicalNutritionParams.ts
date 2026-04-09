import { NutritionService, UserMetricService } from '@/database/services';

import {
  localCalendarWeekIndexSince,
  localDayKeyPlusCalendarDays,
  localDayStartMs,
} from './calendarDate';
import { storedWeightToKg } from './unitConversion';

const LOOKBACK_DAYS = 30;
const MIN_DAYS_WITH_NUTRITION = 7;

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((a, b) => a + b, 0) / values.length;
}

function bucketByWeek(
  points: { date: number; valueKg: number }[],
  startTs: number
): Map<number, { date: number; valueKg: number }[]> {
  const map = new Map<number, { date: number; valueKg: number }[]>();
  for (const p of points) {
    const w = localCalendarWeekIndexSince(p.date, startTs);
    if (!map.has(w)) {
      map.set(w, []);
    }
    map.get(w)!.push(p);
  }

  return map;
}

function bucketByWeekBodyFat(
  points: { date: number; value: number }[],
  startTs: number
): Map<number, { date: number; value: number }[]> {
  const map = new Map<number, { date: number; value: number }[]>();
  for (const p of points) {
    const w = localCalendarWeekIndexSince(p.date, startTs);
    if (!map.has(w)) {
      map.set(w, []);
    }
    map.get(w)!.push(p);
  }

  return map;
}

export interface HistoricalNutritionParams {
  historicalTotalCalories: number;
  historicalTotalDays: number;
  historicalInitialWeightKg: number;
  historicalFinalWeightKg: number;
  historicalInitialFatPercent?: number;
  historicalFinalFatPercent?: number;
}

/**
 * Fetches historical nutrition and body metrics for the last 30 days and returns
 * params suitable for calculateNutritionPlan (empirical TDEE). Returns null when
 * there is insufficient data (fewer than 2 weight entries, or fewer than 7 days
 * with nutrition logs, or zero total calories).
 *
 * Data is read from the local DB only (user_metrics + nutrition_logs); may have
 * been synced from Health Connect or entered manually.
 */
export async function getHistoricalNutritionParams(options: {
  asOfDate?: Date;
  useWeeklyAverages?: boolean;
}): Promise<HistoricalNutritionParams | null> {
  const { asOfDate = new Date(), useWeeklyAverages = true } = options;

  /** Inclusive calendar-day end for the lookback window (local midnight of `asOfDate`). */
  const endDayStartTs = localDayStartMs(asOfDate);
  /** `Date` at local start of `asOfDate` — {@link NutritionService.getRangeNutrients} uses calendar components. */
  const inclusiveRangeEndDate = new Date(endDayStartTs);
  const startTs = localDayKeyPlusCalendarDays(endDayStartTs, -LOOKBACK_DAYS);
  const startOfRange = new Date(startTs);

  const dateRange = { startDate: startTs, endDate: endDayStartTs };

  const [weightMetrics, bodyFatMetrics, rangeNutrients, nutritionLogs] = await Promise.all([
    UserMetricService.getMetricsHistory('weight', dateRange),
    UserMetricService.getMetricsHistory('body_fat', dateRange),
    NutritionService.getRangeNutrients(startOfRange, inclusiveRangeEndDate),
    NutritionService.getNutritionLogsForDateRange(startOfRange, inclusiveRangeEndDate),
  ]);

  const distinctDaysWithNutrition = new Set(nutritionLogs.map((log) => log.date)).size;
  if (distinctDaysWithNutrition < MIN_DAYS_WITH_NUTRITION || rangeNutrients.calories <= 0) {
    return null;
  }

  const weightWithDecrypted = await Promise.all(
    weightMetrics.map(async (m) => {
      const d = await m.getDecrypted();
      const valueKg = storedWeightToKg(d.value, d.unit);
      return { date: m.date, valueKg };
    })
  );

  weightWithDecrypted.sort((a, b) => a.date - b.date);
  if (weightWithDecrypted.length < 2) {
    return null;
  }

  let initialWeight: number;
  let finalWeight: number;

  if (useWeeklyAverages) {
    const weightByWeek = bucketByWeek(weightWithDecrypted, startTs);
    const weekIndices = Array.from(weightByWeek.keys()).sort((a, b) => a - b);
    if (weekIndices.length < 2) {
      return null;
    }
    initialWeight = average(weightByWeek.get(weekIndices[0])!.map((x) => x.valueKg));
    finalWeight = average(
      weightByWeek.get(weekIndices[weekIndices.length - 1])!.map((x) => x.valueKg)
    );
  } else {
    initialWeight = weightWithDecrypted[0].valueKg;
    finalWeight = weightWithDecrypted[weightWithDecrypted.length - 1].valueKg;
  }

  let initialFatPercent: number | undefined;
  let finalFatPercent: number | undefined;

  if (bodyFatMetrics.length > 0) {
    const bodyFatWithDecrypted = await Promise.all(
      bodyFatMetrics.map(async (m) => {
        const d = await m.getDecrypted();
        return { date: m.date, value: d.value };
      })
    );

    bodyFatWithDecrypted.sort((a, b) => a.date - b.date);
    if (useWeeklyAverages) {
      const bodyFatByWeek = bucketByWeekBodyFat(bodyFatWithDecrypted, startTs);
      const weekIndices = Array.from(bodyFatByWeek.keys()).sort((a, b) => a - b);
      if (weekIndices.length >= 2) {
        initialFatPercent = average(bodyFatByWeek.get(weekIndices[0])!.map((x) => x.value));
        finalFatPercent = average(
          bodyFatByWeek.get(weekIndices[weekIndices.length - 1])!.map((x) => x.value)
        );
      } else {
        initialFatPercent = bodyFatWithDecrypted[0].value;
        finalFatPercent = bodyFatWithDecrypted[bodyFatWithDecrypted.length - 1].value;
      }
    } else {
      initialFatPercent = bodyFatWithDecrypted[0].value;
      finalFatPercent = bodyFatWithDecrypted[bodyFatWithDecrypted.length - 1].value;
    }
  }

  return {
    historicalTotalCalories: Math.round(rangeNutrients.calories),
    historicalTotalDays: LOOKBACK_DAYS,
    historicalInitialWeightKg: initialWeight,
    historicalFinalWeightKg: finalWeight,
    ...(initialFatPercent !== undefined && { historicalInitialFatPercent: initialFatPercent }),
    ...(finalFatPercent !== undefined && { historicalFinalFatPercent: finalFatPercent }),
  };
}
