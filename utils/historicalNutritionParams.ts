import { NutritionService, UserMetricService } from '@/database/services';

import {
  bucketPointsByUtcWeek,
  localDayClosedRangeMaxMs,
  localDayKeyPlusCalendarDays,
  localDayStartMs,
  utcDayKeyFromLocalDate,
  utcNormalizedDayKey,
} from './calendarDate';
import { storedWeightToKg } from './unitConversion';

export const HISTORICAL_NUTRITION_LOOKBACK_DAYS = 30;
const MIN_DAYS_WITH_NUTRITION = 7;

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((a, b) => a + b, 0) / values.length;
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
 * Fetches historical nutrition and body metrics for the lookback window and returns
 * params suitable for calculateNutritionPlan (empirical TDEE). Returns null when
 * there is insufficient data (fewer than 2 weight entries, or fewer than
 * `minNutritionDays` days with nutrition logs, or zero total calories).
 *
 * Data is read from the local DB only (user_metrics + nutrition_logs); may have
 * been synced from Health Connect or entered manually.
 */
export async function getHistoricalNutritionParams(options: {
  asOfDate?: Date;
  useWeeklyAverages?: boolean;
  /** Days to look back. Defaults to {@link HISTORICAL_NUTRITION_LOOKBACK_DAYS}. */
  lookbackDays?: number;
  /** Minimum distinct days with nutrition logs required. Defaults to 7. */
  minNutritionDays?: number;
}): Promise<HistoricalNutritionParams | null> {
  const {
    asOfDate = new Date(),
    useWeeklyAverages = true,
    lookbackDays = HISTORICAL_NUTRITION_LOOKBACK_DAYS,
    minNutritionDays = MIN_DAYS_WITH_NUTRITION,
  } = options;

  /** Inclusive calendar-day end for the lookback window (local midnight of `asOfDate`). */
  const endDayStartTs = localDayStartMs(asOfDate);
  const endMetricTs = localDayClosedRangeMaxMs(asOfDate);
  /** `Date` at local start of `asOfDate` — {@link NutritionService.getRangeNutrients} uses calendar components. */
  const inclusiveRangeEndDate = new Date(endDayStartTs);
  const startTs = localDayKeyPlusCalendarDays(endDayStartTs, -lookbackDays);
  const startOfRange = new Date(startTs);

  const utcStartKey = utcDayKeyFromLocalDate(new Date(startTs));

  const dateRange = { startDate: startTs, endDate: endMetricTs };

  const [weightMetrics, bodyFatMetrics, rangeNutrients, nutritionLogs] = await Promise.all([
    UserMetricService.getMetricsHistory('weight', dateRange),
    UserMetricService.getMetricsHistory('body_fat', dateRange),
    NutritionService.getRangeNutrients(startOfRange, inclusiveRangeEndDate),
    NutritionService.getNutritionLogsForDateRange(startOfRange, inclusiveRangeEndDate),
  ]);

  const loggedDayKeys = new Set(
    nutritionLogs.map((log) => utcNormalizedDayKey(log.date, log.timezone))
  );
  const distinctDaysWithNutrition = loggedDayKeys.size;
  // Gate on days with *actual* intake (fasted days excluded) so empirical TDEE is only
  // estimated once there's enough real logging to trust the calorie total.
  if (distinctDaysWithNutrition < minNutritionDays || rangeNutrients.calories <= 0) {
    return null;
  }

  // Empirical TDEE denominator. By default this is the full lookback window (every unlogged
  // day treated as 0 kcal). With the fasting-day feature on, getRangeNutrients sets
  // effectiveDayCount (days that had food plus flagged fasted days), so a forgotten log no
  // longer deflates TDEE while an intentional fast still lowers it as a real 0-kcal day;
  // with the feature off it is undefined and the legacy window applies.
  const historicalTotalDays = rangeNutrients.effectiveDayCount ?? lookbackDays;

  const weightWithDecrypted = await Promise.all(
    weightMetrics.map(async (m) => {
      const d = await m.getDecrypted();
      const valueKg = storedWeightToKg(d.value, d.unit);
      return { date: m.date, timezone: m.timezone, valueKg };
    })
  );

  // Order by the calendar day each record was experienced in (its own timezone), not by raw
  // stored instant — across mixed timezones a smaller instant can belong to a later day.
  weightWithDecrypted.sort(
    (a, b) => utcNormalizedDayKey(a.date, a.timezone) - utcNormalizedDayKey(b.date, b.timezone)
  );
  if (weightWithDecrypted.length < 2) {
    return null;
  }

  let initialWeight: number;
  let finalWeight: number;

  if (useWeeklyAverages) {
    const weightByWeek = bucketPointsByUtcWeek(weightWithDecrypted, utcStartKey);
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
        return { date: m.date, timezone: m.timezone, value: d.value };
      })
    );

    bodyFatWithDecrypted.sort(
      (a, b) => utcNormalizedDayKey(a.date, a.timezone) - utcNormalizedDayKey(b.date, b.timezone)
    );
    if (useWeeklyAverages) {
      const bodyFatByWeek = bucketPointsByUtcWeek(bodyFatWithDecrypted, utcStartKey);
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
    historicalTotalDays,
    historicalInitialWeightKg: initialWeight,
    historicalFinalWeightKg: finalWeight,
    ...(initialFatPercent !== undefined && { historicalInitialFatPercent: initialFatPercent }),
    ...(finalFatPercent !== undefined && { historicalFinalFatPercent: finalFatPercent }),
  };
}
