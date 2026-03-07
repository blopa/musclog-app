import { NutritionService , UserMetricService } from '../database/services';
import { lbsToKg } from './nutritionCalculator';

const LOOKBACK_DAYS = 30;
const MIN_DAYS_WITH_NUTRITION = 7;

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
  units?: 'metric' | 'imperial';
}): Promise<HistoricalNutritionParams | null> {
  const { asOfDate = new Date(), units = 'metric' } = options;

  const endOfDay = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate());
  const endTs = endOfDay.getTime();
  const startTs = endTs - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const startOfRange = new Date(startTs);

  const dateRange = { startDate: startTs, endDate: endTs };

  const [weightMetrics, bodyFatMetrics, rangeNutrients, nutritionLogs] = await Promise.all([
    UserMetricService.getMetricsHistory('weight', dateRange),
    UserMetricService.getMetricsHistory('body_fat', dateRange),
    NutritionService.getRangeNutrients(startOfRange, endOfDay),
    NutritionService.getNutritionLogsForDateRange(startOfRange, endOfDay),
  ]);

  const distinctDaysWithNutrition = new Set(nutritionLogs.map((log) => log.date)).size;
  if (distinctDaysWithNutrition < MIN_DAYS_WITH_NUTRITION || rangeNutrients.calories <= 0) {
    return null;
  }

  const weightWithDecrypted = await Promise.all(
    weightMetrics.map(async (m) => {
      const d = await m.getDecrypted();
      const isLbs = d.unit === 'lbs' || (d.unit == null && units === 'imperial');
      const valueKg = isLbs ? lbsToKg(d.value) : d.value;
      return { date: m.date, valueKg };
    })
  );

  weightWithDecrypted.sort((a, b) => a.date - b.date);
  if (weightWithDecrypted.length < 2) {
    return null;
  }

  const initialWeight = weightWithDecrypted[0].valueKg;
  const finalWeight = weightWithDecrypted[weightWithDecrypted.length - 1].valueKg;

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
    initialFatPercent = bodyFatWithDecrypted[0].value;
    finalFatPercent = bodyFatWithDecrypted[bodyFatWithDecrypted.length - 1].value;
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
