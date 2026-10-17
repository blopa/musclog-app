import { localDayStartFromUtcMs } from '@/utils/calendarDate';

import { healthObservationSchema } from './preferences';
import type { HealthCycleObservation } from './types';

export interface DatedHealthObservation extends HealthCycleObservation {
  date: number;
}
export function mergeHealthObservations(
  existing: HealthCycleObservation[],
  incoming: HealthCycleObservation[]
) {
  const byId = new Map(
    existing.map((observation) => [`${observation.source}:${observation.id}`, observation])
  );
  for (const value of incoming) {
    const observation = healthObservationSchema.parse(value);
    byId.set(`${observation.source}:${observation.id}`, observation);
  }

  if (byId.size > 100) {
    throw new Error('too_many_daily_health_observations');
  }

  return [...byId.values()];
}

export function groupHealthObservations(input: DatedHealthObservation[], now = Date.now()) {
  const days = new Map<number, HealthCycleObservation[]>();
  for (const { date, ...observation } of input) {
    if (!Number.isFinite(date) || date > now || date < new Date(1900, 0, 1).getTime()) {
      throw new Error('invalid_health_date');
    }

    const day = localDayStartFromUtcMs(date);
    days.set(day, mergeHealthObservations(days.get(day) ?? [], [observation]));
  }

  return days;
}
