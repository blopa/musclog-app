import { MS_PER_SOLAR_DAY } from './calendarDate';
import { averagePointsByDay } from './trendWeight';

export interface MetricPoint {
  date: number;
  value: number;
}

export interface EmpiricalTDEEWindow {
  empiricalStart: number;
  empiricalEnd: number;
  initialWeight: number;
  finalWeight: number;
  initialFat?: number;
  finalFat?: number;
  empiricalDays: number;
}

export interface EmpiricalTDEEWindowOptions {
  /**
   * The weight series is already a smoothed trend, so its endpoints must NOT be averaged again —
   * that would stack a second lag on top of the smoothing and make these anchors disagree with
   * every other trend consumer. The window follows the weight anchors, so it stays the full
   * first-to-last common day rather than the 7-day centroid span.
   *
   * Deliberately scoped to the WEIGHT series: body-fat endpoints are averaged whenever the window
   * is long enough regardless, because they are not smoothed and they do not define the window.
   * An earlier `useEndpointAverages` flag governed both at once, which silently downgraded the
   * fat anchors to single-day readings and forced the caller into a second, duplicate call just
   * to recover them.
   */
  weightsArePresmoothed?: boolean;
}

/** Days at each end whose values are averaged together when the window is long enough. */
const ENDPOINT_WINDOW_DAYS = 7;
/** Below this many common days, averaging endpoints would eat most of the window. */
const MIN_DAYS_FOR_ENDPOINT_AVERAGES = 14;

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * The value of `byDay` at one end of the window: either the mean across that end's days, or the
 * single reading on the boundary day. Returns undefined when the series has no reading there,
 * which is how an absent body-fat anchor stays absent.
 */
function anchorValue(
  byDay: Map<number, number>,
  days: number[],
  average: boolean
): number | undefined {
  if (!average) {
    return byDay.get(days[0]);
  }

  const values = days
    .map((day) => byDay.get(day))
    .filter((value): value is number => value !== undefined);
  return values.length > 0 ? mean(values) : undefined;
}

/**
 * Calculates the tracking window and anchor values for empirical TDEE.
 * It prioritizes days where both weight and body fat are recorded.
 * If > 14 such days exist, it uses weekly averages (first/last 7 days) to smooth fluctuations.
 *
 * NOTE: MetricPoint.date values are expected to be UTC-normalized day keys
 * (from decryptMetricPoints). Do NOT call localDayStartFromUtcMs on them.
 */
export function calculateEmpiricalTDEEWindow(
  weightPoints: MetricPoint[],
  fatPoints: MetricPoint[],
  startDate: number,
  endDate: number,
  options: EmpiricalTDEEWindowOptions = {}
): EmpiricalTDEEWindow {
  // p.date is already a UTC-midnight key — use it directly as the day key. Two readings on one
  // day collapse to their mean, the same way every other daily series in the app does; this used
  // to be a last-one-wins `Map.set`, so "my weight on day X" answered differently here than on
  // the chart or in the weekly check-in.
  const weightByDay = new Map(averagePointsByDay(weightPoints).map((p) => [p.date, p.value]));
  const fatByDay = new Map(averagePointsByDay(fatPoints).map((p) => [p.date, p.value]));

  const commonDays = Array.from(weightByDay.keys())
    .filter((day) => fatByDay.has(day))
    .sort((a, b) => a - b);

  if (commonDays.length < 2) {
    // Fallback: use the weight measurement window and take whatever BF is closest (handled by calculateTDEE)
    const hasWeightData = weightPoints.length >= 2;
    const empiricalStart = hasWeightData ? weightPoints[0].date : startDate;
    const empiricalEnd = hasWeightData ? weightPoints[weightPoints.length - 1].date : endDate;

    return {
      empiricalStart,
      empiricalEnd,
      initialWeight: weightPoints[0]?.value || 0,
      finalWeight: weightPoints[weightPoints.length - 1]?.value || 0,
      initialFat: fatPoints[0]?.value,
      finalFat: fatPoints[fatPoints.length - 1]?.value,
      empiricalDays: empiricalDaysBetween(empiricalStart, empiricalEnd),
    };
  }

  const longEnoughToAverage = commonDays.length > MIN_DAYS_FOR_ENDPOINT_AVERAGES;
  const averageWeights = longEnoughToAverage && !options.weightsArePresmoothed;
  const startDays = averageWeights ? commonDays.slice(0, ENDPOINT_WINDOW_DAYS) : [commonDays[0]];
  const endDays = averageWeights
    ? commonDays.slice(-ENDPOINT_WINDOW_DAYS)
    : [commonDays[commonDays.length - 1]];

  // The window has to match the weight anchors: TDEE compares the calories eaten across it
  // against the weight change measured at its ends.
  const empiricalStart = mean(startDays);
  const empiricalEnd = mean(endDays);
  // Body fat neither defines the window nor arrives pre-smoothed, so it averages on its own terms.
  const fatDaysStart = longEnoughToAverage ? commonDays.slice(0, ENDPOINT_WINDOW_DAYS) : startDays;
  const fatDaysEnd = longEnoughToAverage ? commonDays.slice(-ENDPOINT_WINDOW_DAYS) : endDays;

  return {
    empiricalStart,
    empiricalEnd,
    initialWeight: anchorValue(weightByDay, startDays, averageWeights) ?? 0,
    finalWeight: anchorValue(weightByDay, endDays, averageWeights) ?? 0,
    initialFat: anchorValue(fatByDay, fatDaysStart, longEnoughToAverage),
    finalFat: anchorValue(fatByDay, fatDaysEnd, longEnoughToAverage),
    empiricalDays: empiricalDaysBetween(empiricalStart, empiricalEnd),
  };
}

function empiricalDaysBetween(empiricalStart: number, empiricalEnd: number): number {
  return Math.max(0, Math.ceil((empiricalEnd - empiricalStart) / MS_PER_SOLAR_DAY));
}
