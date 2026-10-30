import { getNutritionDayStatuses, type NutritionDayStatus } from '@/database/nutritionDayCoverage';
import { NutritionService } from '@/database/services/NutritionService';
import { dayKeyRange, utcDayKeyFromLocalDate } from '@/utils/calendarDate';

/**
 * Which days between `startDate` and `endDate` (inclusive, device-local calendar days) have
 * food logged or are flagged as fasted, keyed by `utcDayKeyFromLocalDate` of the day. Only the
 * plaintext `date`/`timezone` columns are read, so no log is decrypted.
 */
export async function loadNutritionDayStatuses(
  startDate: Date,
  endDate: Date
): Promise<Map<number, NutritionDayStatus>> {
  const logs = await NutritionService.getNutritionLogsForDateRange(startDate, endDate);
  const range = dayKeyRange(utcDayKeyFromLocalDate(startDate), utcDayKeyFromLocalDate(endDate));

  return getNutritionDayStatuses(logs, range);
}
