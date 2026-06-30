import { differenceInCalendarDays } from 'date-fns';

import { DEFAULT_PERIOD_DURATION } from '@/constants/cycle';
import { SyncGoal } from '@/database/models/MenstrualCycle';
import PeriodLog from '@/database/models/PeriodLog';
import { dayStartInTimezone, localDayStartFromUtcMs, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

export type MenstrualPhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';
export type EnergyLevel = 'peak' | 'high' | 'moderate' | 'low';
export type PredictionConfidence = 'none' | 'low' | 'medium' | 'high';

export interface CycleStats {
  avgCycleLength: number;
  avgPeriodDuration: number;
  minCycleLength: number;
  maxCycleLength: number;
  isIrregular: boolean;
  confidence: PredictionConfidence;
  logCount: number;
}

type CycleStatsFallback = {
  avgCycleLength?: number | null;
  avgPeriodDuration?: number | null;
};

const DEFAULT_CYCLE_LENGTH = 28;
// The luteal phase (ovulation → next period) is stable at ~14 days across most cycles.
// The follicular phase varies. We anchor predictions on this constant.
const LUTEAL_PHASE_DAYS = 14;
// Cycle is considered irregular when the spread between shortest and longest observed
// cycle exceeds this threshold (per clinical standards — ACOG definition of irregular cycles).
const IRREGULAR_SPREAD_THRESHOLD_DAYS = 9;
// Log count thresholds for prediction confidence levels.
const MIN_LOGS_MEDIUM_CONFIDENCE = 2;
const MIN_LOGS_HIGH_CONFIDENCE = 4;

function getPredictionConfidence(logCount: number): PredictionConfidence {
  if (logCount < MIN_LOGS_MEDIUM_CONFIDENCE) {
    return 'low';
  }

  if (logCount < MIN_LOGS_HIGH_CONFIDENCE) {
    return 'medium';
  }

  return 'high';
}

export class MenstrualService {
  /**
   * Calculates cycle stats from actual period log history.
   * Cycle length = days between consecutive period start dates.
   * Period duration = days from start to end (for logs that have ended).
   */
  static calculateCycleStats(
    periodLogs: PeriodLog[],
    fallback: CycleStatsFallback = {}
  ): CycleStats {
    const sorted = [...periodLogs].sort((a, b) => a.startDate - b.startDate);
    const logCount = sorted.length;
    const fallbackCycleLength = fallback.avgCycleLength ?? DEFAULT_CYCLE_LENGTH;
    const fallbackPeriodDuration = fallback.avgPeriodDuration ?? DEFAULT_PERIOD_DURATION;

    if (logCount === 0) {
      return {
        avgCycleLength: fallbackCycleLength,
        avgPeriodDuration: fallbackPeriodDuration,
        minCycleLength: fallbackCycleLength,
        maxCycleLength: fallbackCycleLength,
        isIrregular: false,
        confidence: 'none',
        logCount: 0,
      };
    }

    // Calculate cycle lengths from consecutive period start dates
    const cycleLengths: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = Math.round((sorted[i].startDate - sorted[i - 1].startDate) / MS_PER_SOLAR_DAY);
      if (days >= 15 && days <= 60) {
        // Sanity filter: ignore clearly wrong values
        cycleLengths.push(days);
      }
    }

    const avgCycleLength =
      cycleLengths.length > 0
        ? Math.round(cycleLengths.reduce((sum, l) => sum + l, 0) / cycleLengths.length)
        : fallbackCycleLength;

    const minCycleLength = cycleLengths.length > 0 ? Math.min(...cycleLengths) : avgCycleLength;
    const maxCycleLength = cycleLengths.length > 0 ? Math.max(...cycleLengths) : avgCycleLength;

    const isIrregular = maxCycleLength - minCycleLength > IRREGULAR_SPREAD_THRESHOLD_DAYS;

    // Period duration: average of logs with known end dates
    const knownDurations = sorted
      .filter((log) => log.endDate != null)
      .map((log) => log.getDurationDays())
      .filter((d): d is number => d != null && d >= 1 && d <= 14);

    const avgPeriodDuration =
      knownDurations.length > 0
        ? Math.round(knownDurations.reduce((sum, d) => sum + d, 0) / knownDurations.length)
        : fallbackPeriodDuration;

    const confidence: PredictionConfidence = getPredictionConfidence(logCount);

    return {
      avgCycleLength,
      avgPeriodDuration,
      minCycleLength,
      maxCycleLength,
      isIrregular,
      confidence,
      logCount,
    };
  }

  /**
   * Returns the latest period log (most recent start date), or null if none.
   */
  static getLatestPeriodLog(periodLogs: PeriodLog[]): PeriodLog | null {
    if (periodLogs.length === 0) {
      return null;
    }

    return periodLogs.reduce((latest, log) => (log.startDate > latest.startDate ? log : latest));
  }

  /**
   * Returns the active period log (has a start but no end), or null.
   */
  static getActivePeriodLog(periodLogs: PeriodLog[], nowMs = Date.now()): PeriodLog | null {
    return periodLogs.find((log) => log.isActive && log.startDate <= nowMs) ?? null;
  }

  /**
   * Predicts the next period start date.
   * Uses luteal-phase anchoring: ovulation ≈ next period − 14 days.
   * Returns a range [earliest, latest] for irregular cycles.
   */
  static predictNextPeriod(
    periodLogs: PeriodLog[],
    stats: CycleStats
  ): { date: Date; earliest: Date; latest: Date } | null {
    const latest = this.getLatestPeriodLog(periodLogs);
    if (latest == null) {
      return null;
    }

    const predictedMs = latest.startDate + stats.avgCycleLength * MS_PER_SOLAR_DAY;
    const spreadMs = ((stats.maxCycleLength - stats.minCycleLength) / 2) * MS_PER_SOLAR_DAY;

    return {
      date: new Date(predictedMs),
      earliest: new Date(predictedMs - spreadMs),
      latest: new Date(predictedMs + spreadMs),
    };
  }

  /**
   * Calculates the current cycle day (1-indexed) from the latest period log.
   * Returns null if no period has been logged.
   */
  static getCycleDay(
    periodLogs: PeriodLog[],
    stats: CycleStats,
    timezone?: string | null
  ): number | null {
    const latest = this.getLatestPeriodLog(periodLogs);
    if (latest == null) {
      return null;
    }

    const anchorDay = dayStartInTimezone(latest.startDate, timezone ?? undefined);
    const currentDay = localDayStartFromUtcMs(Date.now());
    const diffDays = Math.max(
      0,
      differenceInCalendarDays(new Date(currentDay), new Date(anchorDay))
    );

    // Normalize to cycle length so it wraps if the app hasn't been updated
    return (diffDays % stats.avgCycleLength) + 1;
  }

  /**
   * Returns the inclusive endDate for a period given its start and average duration.
   * endDate is stored as the last calendar day of the period (inclusive), so
   * a 5-day period starting June 1 ends June 5 = start + (duration − 1) days.
   * All code that infers an endDate from an average must go through this helper.
   */
  static inferPeriodEndDate(startDate: number, durationDays: number): number {
    return startDate + (durationDays - 1) * MS_PER_SOLAR_DAY;
  }

  /**
   * Determines the menstrual phase at an explicit timestamp.
   * Uses luteal-phase anchoring: predicted ovulation = next period start − 14 days.
   * Returns null when there is no period log with a startDate ≤ timestampMs.
   */
  static getPhaseAtTimestamp(
    periodLogs: PeriodLog[],
    stats: CycleStats,
    timestampMs: number
  ): MenstrualPhase | null {
    // Find the most recent log whose period started on or before the queried timestamp
    const logsBeforeTime = periodLogs.filter((l) => l.startDate <= timestampMs);
    if (logsBeforeTime.length === 0) {
      return null;
    }

    const latest = logsBeforeTime.reduce((a, b) => (a.startDate > b.startDate ? a : b));

    // Menstrual: covers the full end day. endDate is stored as an inclusive local-day boundary,
    // so use endDate + MS_PER_SOLAR_DAY as the exclusive upper bound so the entire logged day counts.
    // For open-ended (active) logs, infer the end from average duration as an exclusive bound directly.
    const periodEndExclusive =
      latest.endDate != null
        ? latest.endDate + MS_PER_SOLAR_DAY
        : latest.startDate + stats.avgPeriodDuration * MS_PER_SOLAR_DAY;
    if (timestampMs < periodEndExclusive) {
      return 'menstrual';
    }

    const ovulationMs = this.predictedOvulationMs(latest, stats);
    const ovulationWindowStartMs = ovulationMs - 2 * MS_PER_SOLAR_DAY;
    const ovulationWindowEndMs = ovulationMs + 2 * MS_PER_SOLAR_DAY;

    if (timestampMs >= ovulationWindowStartMs && timestampMs <= ovulationWindowEndMs) {
      return 'ovulatory';
    }

    if (timestampMs < ovulationWindowStartMs) {
      return 'follicular';
    }

    return 'luteal';
  }

  /**
   * Determines the current menstrual phase from period logs.
   * Uses luteal-phase anchoring: predicted ovulation = next period start − 14 days.
   * Returns null when there is no logged data at all.
   */
  static calculateCurrentPhase(periodLogs: PeriodLog[], stats: CycleStats): MenstrualPhase | null {
    return this.getPhaseAtTimestamp(periodLogs, stats, Date.now());
  }

  /**
   * Predicted ovulation timestamp: next period start minus the stable luteal phase.
   */
  private static predictedOvulationMs(latest: PeriodLog, stats: CycleStats): number {
    return latest.startDate + (stats.avgCycleLength - LUTEAL_PHASE_DAYS) * MS_PER_SOLAR_DAY;
  }

  /**
   * Returns the predicted energy level for a given phase.
   */
  static getEnergyLevel(phase: MenstrualPhase): EnergyLevel {
    switch (phase) {
      case 'menstrual':
        return 'low';
      case 'follicular':
        return 'high';
      case 'ovulatory':
        return 'peak';
      case 'luteal':
        return 'moderate';
      default:
        return 'moderate';
    }
  }

  /**
   * Returns an intensity multiplier for workouts based on phase and user goals.
   */
  static getIntensityMultiplier(phase: MenstrualPhase, goal?: SyncGoal): number {
    const multipliers: Record<MenstrualPhase, number> = {
      menstrual: 0.85,
      follicular: 1.0,
      ovulatory: 1.1,
      luteal: 0.95,
    };

    let multiplier = multipliers[phase];

    if (goal === 'performance') {
      if (phase === 'ovulatory') {
        multiplier = 1.15;
      }

      if (phase === 'follicular') {
        multiplier = 1.05;
      }
    } else if (goal === 'symptoms') {
      if (phase === 'menstrual') {
        multiplier = 0.75;
      }

      if (phase === 'luteal') {
        multiplier = 0.9;
      }
    }

    return multiplier;
  }

  /**
   * Gets physiological insights for the current phase.
   */
  static getInsights(phase: MenstrualPhase) {
    switch (phase) {
      case 'menstrual':
        return {
          estrogen: 'low',
          progesterone: 'low',
          metabolism: 'stable',
          focus: 'recovery',
        };
      case 'follicular':
        return {
          estrogen: 'rising',
          progesterone: 'low',
          metabolism: 'stable',
          focus: 'strength',
        };
      case 'ovulatory':
        return {
          estrogen: 'peak',
          progesterone: 'rising',
          metabolism: 'increasing',
          focus: 'power',
        };
      case 'luteal':
        return {
          estrogen: 'dropping',
          progesterone: 'peak',
          metabolism: 'high',
          focus: 'endurance',
        };
    }
  }

  /**
   * Returns the predicted fertile window: 5 days before ovulation to 1 day after.
   */
  static getFertileWindow(
    periodLogs: PeriodLog[],
    stats: CycleStats
  ): { start: Date; end: Date } | null {
    const latest = this.getLatestPeriodLog(periodLogs);
    if (latest == null) {
      return null;
    }

    const ovulationMs = this.predictedOvulationMs(latest, stats);

    return {
      start: new Date(ovulationMs - 5 * MS_PER_SOLAR_DAY),
      end: new Date(ovulationMs + MS_PER_SOLAR_DAY),
    };
  }
}
