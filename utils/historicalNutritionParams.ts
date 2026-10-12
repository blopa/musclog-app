import { NutritionService } from '@/database/services/NutritionService';
import { UserMetricService } from '@/database/services/UserMetricService';

import {
  bucketPointsByUtcWeek,
  calendarDateFromRecordDay,
  localDayClosedRangeMaxMs,
  localDayKeyPlusCalendarDays,
  localDayStartMs,
  MS_PER_SOLAR_DAY,
  utcDayKeyFromLocalDate,
  utcNormalizedDayKey,
} from './calendarDate';
import {
  calculateTrendWeightSeries,
  TREND_WEIGHT_WARMUP_DAYS,
  trendWeightAtOrBefore,
} from './trendWeight';
import { storedWeightToKg } from './unitConversion';

export const HISTORICAL_NUTRITION_LOOKBACK_DAYS = 30;
export const MIN_DAYS_WITH_NUTRITION = 7;
export const MIN_WEIGHT_ENTRIES = 2;

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface HistoricalNutritionParams {
  historicalTotalCalories: number;
  historicalTotalDays: number;
  /** Calendar days elapsed between the weight anchors, independent of food-log coverage. */
  historicalWeightChangeDays: number;
  /** Trend weight at the beginning of the empirical window. */
  historicalInitialWeightKg: number;
  /** Trend weight at the end of the empirical window. */
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
  /**
   * Average the body-fat anchors over the first and last week of the window instead of taking the
   * single earliest and latest readings. Body fat only: weight anchors always come from the trend
   * series, which is already smoothed, so there is nothing left for a weekly average to do.
   */
  useWeeklyFatAverages?: boolean;
  /** Days to look back. Defaults to {@link HISTORICAL_NUTRITION_LOOKBACK_DAYS}. */
  lookbackDays?: number;
  /** Minimum distinct days with nutrition logs required. Defaults to 7. */
  minNutritionDays?: number;
  excludeUnloggedDays?: boolean;
}): Promise<HistoricalNutritionParams | null> {
  const {
    asOfDate = new Date(),
    useWeeklyFatAverages = true,
    lookbackDays = HISTORICAL_NUTRITION_LOOKBACK_DAYS,
    minNutritionDays = MIN_DAYS_WITH_NUTRITION,
  } = options;

  /** Inclusive calendar-day end for the lookback window (local midnight of `asOfDate`). */
  const endDayStartTs = localDayStartMs(asOfDate);
  const endMetricTs = localDayClosedRangeMaxMs(asOfDate);
  const startTs = localDayKeyPlusCalendarDays(endDayStartTs, -lookbackDays);

  const utcStartKey = utcDayKeyFromLocalDate(new Date(startTs));

  const dateRange = { startDate: startTs, endDate: endMetricTs };
  const weightDateRange = {
    startDate: localDayKeyPlusCalendarDays(startTs, -TREND_WEIGHT_WARMUP_DAYS),
    endDate: endMetricTs,
  };

  const [weightMetrics, bodyFatMetrics] = await Promise.all([
    UserMetricService.getMetricsHistory('weight', weightDateRange),
    UserMetricService.getMetricsHistory('body_fat', dateRange),
  ]);

  const weightWithDecrypted = await Promise.all(
    weightMetrics.map(async (m) => {
      const d = await m.getDecrypted();
      const valueKg = storedWeightToKg(d.value, d.unit);
      return {
        date: utcNormalizedDayKey(m.date, m.timezone),
        value: valueKg,
      };
    })
  );

  // Normalize by the calendar day each record was experienced in (its own timezone), not by raw
  // stored instant. The trend utility handles sorting and same-day averaging.
  if (weightWithDecrypted.length < MIN_WEIGHT_ENTRIES) {
    return null;
  }

  const trend = calculateTrendWeightSeries(weightWithDecrypted);
  const firstTrendInWindow = trend.find((point) => point.date >= utcStartKey);
  const finalTrend = trendWeightAtOrBefore(trend, utcDayKeyFromLocalDate(asOfDate));
  if (!firstTrendInWindow || !finalTrend || firstTrendInWindow.date >= finalTrend.date) {
    return null;
  }
  const initialWeight = firstTrendInWindow.value;
  const finalWeight = finalTrend.value;

  const historicalWeightChangeDays = (finalTrend.date - firstTrendInWindow.date) / MS_PER_SOLAR_DAY;
  // Intake belongs to the same half-open calendar interval as the weight change. A sparse weight
  // history must not combine a short trend with food from the entire lookback window.
  const firstDay = calendarDateFromRecordDay(firstTrendInWindow.date, '+00:00');
  const lastDay = calendarDateFromRecordDay(finalTrend.date, '+00:00');
  const lastIntakeDay = new Date(localDayKeyPlusCalendarDays(lastDay.getTime(), -1));
  const [rangeNutrients, nutritionLogs] = await Promise.all([
    NutritionService.getRangeNutrients(firstDay, lastIntakeDay),
    NutritionService.getNutritionLogsForDateRange(firstDay, lastIntakeDay),
  ]);
  const loggedDayKeys = new Set(
    nutritionLogs
      .map((log) => utcNormalizedDayKey(log.date, log.timezone))
      .filter((day) => day >= firstTrendInWindow.date && day < finalTrend.date)
  );
  if (loggedDayKeys.size < minNutritionDays || rangeNutrients.calories <= 0) {
    return null;
  }
  // Coverage controls average intake. Tissue energy always uses elapsed anchor days, including
  // days without food logs; intentional fasting contributes a zero to the intake average only.
  const historicalTotalDays =
    rangeNutrients.effectiveDayCount ??
    (options.excludeUnloggedDays ? loggedDayKeys.size : historicalWeightChangeDays);

  let initialFatPercent: number | undefined;
  let finalFatPercent: number | undefined;

  if (bodyFatMetrics.length > 0) {
    const bodyFatWithDecrypted = await Promise.all(
      bodyFatMetrics.map(async (m) => {
        const d = await m.getDecrypted();
        return { date: m.date, timezone: m.timezone, value: d.value };
      })
    );

    const anchoredBodyFat = bodyFatWithDecrypted.filter((metric) => {
      const day = utcNormalizedDayKey(metric.date, metric.timezone);
      return day >= firstTrendInWindow.date && day <= finalTrend.date;
    });
    anchoredBodyFat.sort(
      (a, b) => utcNormalizedDayKey(a.date, a.timezone) - utcNormalizedDayKey(b.date, b.timezone)
    );
    if (anchoredBodyFat.length && useWeeklyFatAverages) {
      const bodyFatByWeek = bucketPointsByUtcWeek(anchoredBodyFat, firstTrendInWindow.date);
      const weekIndices = Array.from(bodyFatByWeek.keys()).sort((a, b) => a - b);
      if (weekIndices.length >= 2) {
        initialFatPercent = average(bodyFatByWeek.get(weekIndices[0])!.map((x) => x.value));
        finalFatPercent = average(
          bodyFatByWeek.get(weekIndices[weekIndices.length - 1])!.map((x) => x.value)
        );
      } else {
        initialFatPercent = anchoredBodyFat[0].value;
        finalFatPercent = anchoredBodyFat[anchoredBodyFat.length - 1].value;
      }
    } else if (anchoredBodyFat.length) {
      initialFatPercent = anchoredBodyFat[0].value;
      finalFatPercent = anchoredBodyFat[anchoredBodyFat.length - 1].value;
    }
  }

  return {
    historicalTotalCalories: Math.round(rangeNutrients.calories),
    historicalTotalDays,
    historicalWeightChangeDays,
    historicalInitialWeightKg: initialWeight,
    historicalFinalWeightKg: finalWeight,
    ...(initialFatPercent !== undefined && { historicalInitialFatPercent: initialFatPercent }),
    ...(finalFatPercent !== undefined && { historicalFinalFatPercent: finalFatPercent }),
  };
}
