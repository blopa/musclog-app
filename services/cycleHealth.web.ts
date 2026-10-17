import type { DatedHealthObservation } from '@/utils/cycle/healthObservations';
import type { CycleDayLogDto } from '@/utils/cycle/types';

export const cycleHealthSupported = false;
export async function readCycleHealth(
  _from: number,
  _to: number
): Promise<DatedHealthObservation[]> {
  throw new Error('health_unavailable');
}

export async function writeCycleHealth(_logs: CycleDayLogDto[]): Promise<number> {
  throw new Error('health_unavailable');
}
