import { UserMetricService } from '@/database/services/UserMetricService';
import { localDayClosedRangeMaxMs, localDayStartMs } from '@/utils/calendarDate';
import { getCurrentTimezone } from '@/utils/timezone';

/**
 * The day's mood stays the app's ordinary `mood` metric (the home prompt and the progress charts
 * already read it), so the cycle day sheet writes it there instead of keeping a second copy.
 */
export async function loadDayMood(day: Date): Promise<{ id: string; value: number } | null> {
  const [metric] = await UserMetricService.getMetricsHistory('mood', {
    startDate: localDayStartMs(day),
    endDate: localDayClosedRangeMaxMs(day),
  });
  if (!metric) {
    return null;
  }

  return { id: metric.id, value: (await metric.getDecrypted()).value };
}

export async function saveDayMood(
  day: Date,
  value: number,
  existingId: string | null
): Promise<void> {
  const date = localDayStartMs(day);
  if (existingId) {
    await UserMetricService.updateMetric(existingId, { value, date });

    return;
  }

  await UserMetricService.createMetric({
    type: 'mood',
    value,
    date,
    timezone: getCurrentTimezone(),
  });
}
