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

type HistoricalNutritionOptions = {
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
};

/**
 * Fetches historical nutrition and body metrics for the lookback window and returns
 * params suitable for calculateNutritionPlan (empirical TDEE). Returns null when
 * there is insufficient data (fewer than 2 weight entries, or fewer than
 * `minNutritionDays` days with nutrition logs, or zero total calories).
 *
 * Data is read from the local DB only (user_metrics + nutrition_logs); may have
 * been synced from Health Connect or entered manually.
 */
export async function getHistoricalNutritionParams(
  options: HistoricalNutritionOptions
): Promise<HistoricalNutritionParams | null> {
  return (await readHistoricalWindow(options))?.params ?? null;
}

export interface HistoricalNutritionWindow {
  params: HistoricalNutritionParams;
  /** Local midnight of the first and last weight anchors the window measured between. */
  startMs: number;
  endMs: number;
  /**
   * The recent lookback had too little data, so the latest earlier stretch of tracking stood in.
   * That TDEE describes the person as they were then, and callers must say so.
   */
  fromPastWindow: boolean;
}

/**
 * The empirical-TDEE window the app actually uses: the lookback ending at `asOfDate` when it has
 * enough data, otherwise the same-length lookback ending at the last day that was tracked — so
 * someone returning after months away gets the TDEE their own tracking measured rather than a
 * population formula. Days without a food log are always left out of the intake average (a
 * forgotten day reads as an average one, not a day of eating nothing); flagged fasting days stay
 * in as 0 kcal, through `getRangeNutrients`' day coverage.
 */
const inFlightWindows = new Map<string, Promise<HistoricalNutritionWindow | null>>();

/**
 * The home screen asks for this window twice at once — `useEmpiricalTDEE` for the TDEE figure and
 * `resolveDailyMacros` for a dynamic goal (plus `WidgetSync`) — and each read decrypts every log in
 * the lookback. Concurrent requests for the same window share one read. Only in-flight requests
 * are shared, never a settled result, so a later call always sees data written since.
 *
 * The key holds the calendar day rather than the instant: the window reads only the day of
 * `asOfDate` (its start, its closed end and its UTC day key), never the time of day.
 */
export function getLatestHistoricalNutritionWindow(
  options: Omit<HistoricalNutritionOptions, 'excludeUnloggedDays'>
): Promise<HistoricalNutritionWindow | null> {
  const asOfDate = options.asOfDate ?? new Date();
  const {
    useWeeklyFatAverages = true,
    lookbackDays = HISTORICAL_NUTRITION_LOOKBACK_DAYS,
    minNutritionDays = MIN_DAYS_WITH_NUTRITION,
  } = options;
  const key = [
    localDayStartMs(asOfDate),
    lookbackDays,
    minNutritionDays,
    useWeeklyFatAverages,
  ].join(':');

  const existing = inFlightWindows.get(key);
  if (existing) {
    return existing;
  }

  const request = readLatestHistoricalNutritionWindow({ ...options, asOfDate }).finally(() => {
    if (inFlightWindows.get(key) === request) {
      inFlightWindows.delete(key);
    }
  });
  inFlightWindows.set(key, request);
  return request;
}

async function readLatestHistoricalNutritionWindow(
  options: Omit<HistoricalNutritionOptions, 'excludeUnloggedDays'> & { asOfDate: Date }
): Promise<HistoricalNutritionWindow | null> {
  const { asOfDate } = options;
  const recent = await readHistoricalWindow({ ...options, asOfDate, excludeUnloggedDays: true });
  if (recent) {
    return { ...recent, fromPastWindow: false };
  }

  for (const anchor of await pastWindowAnchors(asOfDate)) {
    const past = await readHistoricalWindow({
      ...options,
      asOfDate: new Date(anchor),
      excludeUnloggedDays: true,
    });
    if (past) {
      return { ...past, fromPastWindow: true };
    }
  }

  return null;
}

/**
 * Where an earlier window may end, best first. The day after the last food log comes first: a
 * weigh-in that morning still bounds the intake before it. The last weigh-in is tried only when it
 * came before the last food log (weighing stopped first); a later one would stretch the window
 * over weeks with no food at all. Anchors at or after `asOfDate` would repeat the recent window.
 */
async function pastWindowAnchors(asOfDate: Date): Promise<number[]> {
  const asOfDayMs = localDayStartMs(asOfDate);
  const maxMs = localDayClosedRangeMaxMs(asOfDate);
  const [lastFood, lastWeight] = await Promise.all([
    NutritionService.getLatestLogOnOrBefore(maxMs),
    UserMetricService.getLatestOnOrBefore('weight', maxMs),
  ]);

  const anchors: number[] = [];
  const lastFoodDayMs = lastFood
    ? calendarDateFromRecordDay(lastFood.date, lastFood.timezone).getTime()
    : null;
  if (lastFoodDayMs !== null) {
    anchors.push(localDayKeyPlusCalendarDays(lastFoodDayMs, 1));
  }

  if (lastWeight) {
    const lastWeightDayMs = calendarDateFromRecordDay(
      lastWeight.date,
      lastWeight.timezone
    ).getTime();
    if (lastFoodDayMs === null || lastWeightDayMs < lastFoodDayMs) {
      anchors.push(lastWeightDayMs);
    }
  }

  return anchors.filter((anchor) => anchor < asOfDayMs);
}

async function readHistoricalWindow(
  options: HistoricalNutritionOptions
): Promise<Omit<HistoricalNutritionWindow, 'fromPastWindow'> | null> {
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
    params: {
      historicalTotalCalories: Math.round(rangeNutrients.calories),
      historicalTotalDays,
      historicalWeightChangeDays,
      historicalInitialWeightKg: initialWeight,
      historicalFinalWeightKg: finalWeight,
      ...(initialFatPercent !== undefined && { historicalInitialFatPercent: initialFatPercent }),
      ...(finalFatPercent !== undefined && { historicalFinalFatPercent: finalFatPercent }),
    },
    startMs: firstDay.getTime(),
    endMs: lastDay.getTime(),
  };
}
