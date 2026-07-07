/**
 * Shared denominator logic for the fasting-day feature.
 *
 * Every historical macro/calorie average divides a period total by a day count. Under the
 * fasting-day feature that count is the union of:
 *   - distinct days that had logged food, and
 *   - distinct days the user explicitly flagged as fasted (a real 0-kcal day).
 * Unflagged empty days (a forgotten log) are excluded so they don't drag averages toward 0.
 *
 * Both inputs are UTC-normalized day keys (see `utcNormalizedDayKey`), so a fasted day and a
 * logged day on the same calendar day collapse to a single day.
 */
export function effectiveNutritionDayCount(
  loggedDayKeys: Iterable<number>,
  fastedDayKeys: Iterable<number>
): number {
  const union = new Set<number>(loggedDayKeys);
  for (const key of fastedDayKeys) {
    union.add(key);
  }
  return union.size;
}
