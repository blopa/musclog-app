import { STALE_OPEN_PERIOD_DAYS } from '@/constants/cycle';
import { localDayStartFromUtcMs, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { contextAt, type ContextGuidance, contextGuidance } from './contraception';
import { buildCycleHistory } from './cycleHistory';
import { computePredictionStats, type PredictionStats } from './cycleStats';
import { computeCycleTimeline, type CycleTimeline } from './cycleTimeline';
import { isOpenPeriod } from './periodRules';
import type { CycleConfig, CycleContextDto, CycleHistoryEntry, CyclePeriodDto } from './types';

export interface CycleSnapshot {
  activeContext: CycleContextDto | null;
  guidance: ContextGuidance;
  history: CycleHistoryEntry[];
  stats: PredictionStats;
  timeline: CycleTimeline;
  /** The period the user said is still going, ignoring one forgotten long ago. */
  activePeriod: CyclePeriodDto | null;
}

/**
 * Everything the cycle UI, reminders and charts derive from stored records, in one place so no
 * consumer re-assembles it slightly differently.
 */
export function buildCycleSnapshot(input: {
  periods: CyclePeriodDto[];
  contexts: CycleContextDto[];
  config: CycleConfig;
  nowMs: number;
  showPredictions: boolean;
  showFertility: boolean;
}): CycleSnapshot {
  const { periods, contexts, config, nowMs } = input;
  const today = localDayStartFromUtcMs(nowMs);
  const activeContext = contextAt(contexts, today);
  const periodsSinceContext = activeContext
    ? periods.filter((p) => p.startDate >= activeContext.effectiveFrom).length
    : periods.length;
  const guidance = contextGuidance(activeContext, { periodsSinceContext });

  const history = buildCycleHistory(periods, (start) => {
    const at = contextAt(contexts, localDayStartFromUtcMs(start));

    return at ? contextGuidance(at).excludesCycles : null;
  });
  const stats = computePredictionStats(history, {
    avgCycleLength: config.fallbackCycleLength,
    avgPeriodDuration: config.fallbackPeriodDuration,
  });
  const timeline = computeCycleTimeline(periods, stats, {
    today,
    showPredictions: input.showPredictions,
    showFertility: input.showFertility && guidance.fertilityMeaningful,
    suppressed: guidance.suppressedReason != null,
  });
  const activePeriod =
    periods.find(
      (p) =>
        isOpenPeriod(p) &&
        p.startDate <= nowMs + 1 &&
        nowMs - p.startDate <= STALE_OPEN_PERIOD_DAYS * MS_PER_SOLAR_DAY
    ) ?? null;

  return { activeContext, guidance, history, stats, timeline, activePeriod };
}
