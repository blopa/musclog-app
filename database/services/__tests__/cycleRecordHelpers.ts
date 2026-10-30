import { CycleRepository, readPeriods } from '@/database/repositories/CycleRepository';
import { CycleTrackingService } from '@/database/services/CycleTrackingService';

export async function newCycle(periods: { startDate: number; endDate?: number | null }[] = []) {
  return CycleTrackingService.create({
    config: { fallbackCycleLength: 30, fallbackPeriodDuration: 5 },
    periods,
    context: null,
  });
}

export const livePeriods = async (cycleId: string) =>
  readPeriods(await CycleRepository.periods(cycleId).fetch());
