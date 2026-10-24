import { localDayStartFromUtcMs, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { contraceptionFromLegacy, lifeStageFromLegacy } from './contraception';
import type {
  BleedingLevel,
  CycleConfig,
  CycleContextDto,
  CycleDayLogDto,
  CyclePeriodDto,
} from './types';

// Plain shapes of the pre-v36 rows, so the same conversion serves the boot migration (which has
// WatermelonDB models) and a restored old backup (which has raw JSON).
export interface LegacyCycle {
  id: string;
  avgCycleLength: number;
  avgPeriodDuration: number;
  birthControlType: string | null;
  lifeStage: string | null;
  createdAt: number;
}

export interface LegacyPeriod {
  cycleId: string;
  startDate: number;
  endDate: number | null;
  notes: string | null;
  timezone: string | null;
}

export interface LegacyMetric {
  type: 'period_flow' | 'period_symptoms';
  date: number;
  /** Decrypted value: the flow level 1-5, or the symptom count. */
  value: number;
  /** Comma-joined symptom keys (symptoms only). */
  note: string | null;
  timezone: string | null;
}

export type PeriodPayload = Omit<CyclePeriodDto, 'id' | 'cycleId'>;
export type DayLogPayload = Omit<CycleDayLogDto, 'id'>;
export type ContextPayload = Omit<CycleContextDto, 'id' | 'cycleId'>;

export interface ConvertedCycle {
  config: CycleConfig;
  periods: PeriodPayload[];
  context: ContextPayload | null;
}

const FLOW_TO_BLEEDING: Record<number, BleedingLevel> = {
  1: 'spotting',
  2: 'light',
  3: 'medium',
  4: 'heavy',
  5: 'very_heavy',
};

/** A legacy period still "open" after this long was forgotten, not ongoing. */
const STALE_OPEN_DAYS = 14;

export function convertLegacyCycleData(input: {
  cycles: LegacyCycle[];
  periods: LegacyPeriod[];
  metrics: LegacyMetric[];
  fallbackTimezone: string;
  now?: number;
}): { cycles: Map<string, ConvertedCycle>; dayLogs: DayLogPayload[] } {
  const now = input.now ?? Date.now();
  const converted = new Map<string, ConvertedCycle>();

  for (const cycle of input.cycles) {
    const own = input.periods
      .filter((p) => p.cycleId === cycle.id)
      .sort((a, b) => a.startDate - b.startDate);
    const avgDuration = cycle.avgPeriodDuration || 5;

    const periods: PeriodPayload[] = own.map((p) => {
      const timezone = p.timezone || input.fallbackTimezone;
      const base = {
        startDate: p.startDate,
        timezone,
        excludedFromStats: false,
        note: p.notes ?? '',
      };
      if (p.endDate == null) {
        const stale = now - p.startDate > STALE_OPEN_DAYS * MS_PER_SOLAR_DAY;

        return { ...base, endDate: null, endKind: stale ? 'unknown' : 'open' };
      }

      // The old "past period" and backfill paths invented an end from the average duration and
      // stored it as if it were logged. An end that matches that formula exactly is flagged as
      // estimated so it neither feeds the average period length nor passes as a fact.
      const inferred = p.startDate + (avgDuration - 1) * MS_PER_SOLAR_DAY;

      return {
        ...base,
        endDate: p.endDate,
        endKind: p.endDate === inferred ? 'estimated' : 'logged',
      };
    });

    const contraception = contraceptionFromLegacy(cycle.birthControlType);
    const lifeStage = lifeStageFromLegacy(cycle.lifeStage);
    const hasContext = contraception !== 'none' || lifeStage !== 'regular';
    const earliest = Math.min(cycle.createdAt, ...own.map((p) => p.startDate));

    converted.set(cycle.id, {
      config: {
        fallbackCycleLength: cycle.avgCycleLength || 28,
        fallbackPeriodDuration: avgDuration,
      },
      periods,
      context: hasContext
        ? {
            effectiveFrom: localDayStartFromUtcMs(earliest),
            timezone: input.fallbackTimezone,
            lifeStage,
            contraception,
            note: '',
          }
        : null,
    });
  }

  const byDay = new Map<number, DayLogPayload>();
  for (const metric of input.metrics) {
    const date = localDayStartFromUtcMs(metric.date);
    const log = byDay.get(date) ?? {
      date,
      timezone: metric.timezone || input.fallbackTimezone,
      bleeding: null,
      symptoms: [],
      noSymptoms: false,
      pain: null,
      energy: null,
      note: '',
    };

    if (metric.type === 'period_flow') {
      log.bleeding = FLOW_TO_BLEEDING[Math.round(metric.value)] ?? log.bleeding;
    } else {
      const keys = (metric.note ?? '')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      for (const key of keys) {
        if (!log.symptoms.some((s) => s.key === key)) {
          // The old format recorded that a symptom was present, never how strongly.
          log.symptoms.push({ key, severity: null });
        }
      }
    }

    byDay.set(date, log);
  }

  return {
    cycles: converted,
    dayLogs: [...byDay.values()].filter((l) => l.bleeding != null || l.symptoms.length > 0),
  };
}
