import { LUTEAL_PHASE_DAYS, OVULATORY_HALF_WINDOW_DAYS } from '@/constants/cycle';
import { localDayStartFromUtcMs, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { addCalendarDays } from './dates';
import type { PredictionStats } from './cycleStats';
import type { CyclePeriodInput } from './types';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface PhaseSegment {
  key: CyclePhase;
  /** Zero-based day offset from the period start where the segment begins. */
  startDay: number;
  length: number;
}

export type PredictionState =
  'hidden' | 'insufficient' | 'upcoming' | 'window' | 'late' | 'suppressed';

export interface CycleTimeline {
  /** Days since the actual last period start, 1-based. It never wraps. */
  elapsedDay: number | null;
  prediction: {
    state: PredictionState;
    mostLikely: number | null;
    earliest: number | null;
    latest: number | null;
    daysLate: number;
  };
  /** Null whenever the layout would be a guess: late, hidden, suppressed or no data. */
  segments: PhaseSegment[] | null;
  currentPhase: CyclePhase | null;
  fertileEstimate: { start: number; end: number } | null;
  cycleLength: number;
}

export interface TimelineOptions {
  /** Local midnight ms of today. */
  today: number;
  showPredictions?: boolean;
  /** Whether the user opted in AND the context makes an ovulation estimate meaningful. */
  showFertility?: boolean;
  /** Set by the context (hormonal method, postpartum, no bleeding): no prediction is shown. */
  suppressed?: boolean;
}

const dayDiff = (from: number, to: number) => Math.round((to - from) / MS_PER_SOLAR_DAY);

/**
 * Starts and ends are stored as local-midnight instants, but one logged in another timezone
 * can fall hours after today's local midnight and would read as "in the future". Anchoring to
 * the local calendar day makes every comparison day-for-day.
 */
const anchorDays = (periods: CyclePeriodInput[]): CyclePeriodInput[] =>
  periods.map((p) => ({
    ...p,
    startDate: localDayStartFromUtcMs(p.startDate),
    endDate: p.endDate != null ? localDayStartFromUtcMs(p.endDate) : null,
  }));

/**
 * The one phase layout. The wheel, the cycle screen, reminders and charts all read it, so
 * they cannot disagree about where ovulation falls.
 */
export function buildPhaseSegments(cycleLength: number, periodDuration: number): PhaseSegment[] {
  const menstrual = Math.max(1, Math.min(periodDuration, cycleLength - 2));
  const ovulationDay = cycleLength - LUTEAL_PHASE_DAYS;
  const ovStart = Math.min(
    Math.max(menstrual, ovulationDay - OVULATORY_HALF_WINDOW_DAYS),
    cycleLength - 2
  );
  const ovEnd = Math.min(
    cycleLength - 2,
    Math.max(ovStart, ovulationDay + OVULATORY_HALF_WINDOW_DAYS)
  );

  return [
    { key: 'menstrual', startDay: 0, length: menstrual },
    { key: 'follicular', startDay: menstrual, length: ovStart - menstrual },
    { key: 'ovulatory', startDay: ovStart, length: ovEnd - ovStart + 1 },
    { key: 'luteal', startDay: ovEnd + 1, length: cycleLength - ovEnd - 1 },
  ];
}

function phaseAtOffset(segments: PhaseSegment[], offset: number): CyclePhase {
  const hit = segments.find((s) => offset >= s.startDay && offset < s.startDay + s.length);

  return hit ? hit.key : segments[segments.length - 1].key;
}

export function computeCycleTimeline(
  periods: CyclePeriodInput[],
  stats: PredictionStats,
  options: TimelineOptions
): CycleTimeline {
  const { today, showPredictions = true, showFertility = true, suppressed = false } = options;
  const latest = anchorDays(periods).reduce<CyclePeriodInput | null>(
    (acc, p) => (p.startDate <= today && (!acc || p.startDate > acc.startDate) ? p : acc),
    null
  );
  const cycleLength = stats.medianLength;

  if (!latest) {
    return {
      elapsedDay: null,
      prediction: {
        state: 'insufficient',
        mostLikely: null,
        earliest: null,
        latest: null,
        daysLate: 0,
      },
      segments: null,
      currentPhase: null,
      fertileEstimate: null,
      cycleLength,
    };
  }

  const offset = dayDiff(latest.startDate, today);
  const mostLikely = addCalendarDays(latest.startDate, cycleLength);
  const earliest = addCalendarDays(latest.startDate, Math.min(stats.rangeLow, cycleLength - 1));
  const latestDate = addCalendarDays(latest.startDate, Math.max(stats.rangeHigh, cycleLength + 1));

  let state: PredictionState;
  let daysLate = 0;
  if (suppressed) {
    state = 'suppressed';
  } else if (!showPredictions) {
    state = 'hidden';
  } else if (today < earliest) {
    state = 'upcoming';
  } else if (today <= latestDate) {
    state = 'window';
  } else {
    state = 'late';
    daysLate = dayDiff(latestDate, today);
  }

  const segments =
    state === 'upcoming' || state === 'window'
      ? buildPhaseSegments(cycleLength, stats.avgPeriodDuration)
      : null;

  // The logged bleeding is a fact; the rest of the layout is only an estimate.
  const inPeriod =
    latest.endDate != null ? today <= latest.endDate : offset < stats.avgPeriodDuration;
  let currentPhase: CyclePhase | null = null;
  if (inPeriod) {
    currentPhase = 'menstrual';
  } else if (segments) {
    currentPhase = phaseAtOffset(segments, offset);
  }

  let fertileEstimate: CycleTimeline['fertileEstimate'] = null;
  if (showFertility && segments) {
    const ovulation = addCalendarDays(latest.startDate, cycleLength - LUTEAL_PHASE_DAYS);
    fertileEstimate = {
      start: addCalendarDays(ovulation, -5),
      end: addCalendarDays(ovulation, 1),
    };
  }

  return {
    elapsedDay: offset + 1,
    prediction: { state, mostLikely, earliest, latest: latestDate, daysLate },
    segments,
    currentPhase,
    fertileEstimate,
    cycleLength,
  };
}

/**
 * Phase of a past or present day, for charts. When a later period is logged the real cycle
 * length is known, so that is used instead of the average.
 */
export function phaseAtDay(
  periods: CyclePeriodInput[],
  stats: PredictionStats,
  day: number
): CyclePhase | null {
  const sorted = anchorDays(periods).sort((a, b) => a.startDate - b.startDate);
  const index = sorted.reduce((acc, p, i) => (p.startDate <= day ? i : acc), -1);
  if (index < 0) {
    return null;
  }

  const period = sorted[index];
  const next = sorted[index + 1];
  const offset = dayDiff(period.startDate, day);
  const duration =
    period.endDate != null
      ? dayDiff(period.startDate, period.endDate) + 1
      : stats.avgPeriodDuration;
  if (offset < duration) {
    return 'menstrual';
  }

  const length = next ? dayDiff(period.startDate, next.startDate) : stats.medianLength;
  if (offset >= length + (next ? 0 : Math.max(stats.rangeHigh - length, 1))) {
    return null;
  }

  return phaseAtOffset(buildPhaseSegments(length, duration), offset);
}
