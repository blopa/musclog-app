import { STALE_OPEN_PERIOD_DAYS } from '@/constants/cycle';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import type { CycleTimeline } from './cycleTimeline';
import { isBleeding } from './dayLog';
import { periodLastDay } from './periodRules';
import type { BleedingLevel, CycleDayLogDto, CyclePeriodInput } from './types';

export interface DayMarkers {
  /** Inside a logged period. */
  period: boolean;
  /** Bleeding level logged that day (the day log), if any. */
  bleeding: BleedingLevel | null;
  /** Inside the window the next period is predicted to start in. */
  predicted: boolean;
  /** Inside the optional fertile-window estimate. */
  fertile: boolean;
  /** Something other than bleeding was logged (symptoms, pain, energy, a note, "no symptoms"). */
  observation: boolean;
}

export const EMPTY_MARKERS: DayMarkers = {
  period: false,
  bleeding: null,
  predicted: false,
  fertile: false,
  observation: false,
};

/** Last day a period visibly occupies; an open one stops at today (or at a stale cap). */
function visibleLastDay(period: CyclePeriodInput, today: number): number {
  const last = periodLastDay(period);
  if (last !== Number.POSITIVE_INFINITY) {
    return last;
  }

  return Math.min(today, period.startDate + STALE_OPEN_PERIOD_DAYS * MS_PER_SOLAR_DAY);
}

/**
 * Per-day markers for the calendar. Logged facts (a period, bleeding, an observation) and
 * estimates (predicted, fertile) are separate flags so the UI can draw them differently and
 * describe them in words; a logged day is never also shown as predicted.
 */
export function calendarMarkers(input: {
  periods: CyclePeriodInput[];
  dayLogs: CycleDayLogDto[];
  timeline: CycleTimeline | null;
  today: number;
}): (day: number) => DayMarkers {
  const { periods, dayLogs, timeline, today } = input;
  const logs = new Map(dayLogs.map((l) => [l.date, l]));
  const { prediction, fertileEstimate } = timeline ?? { prediction: null, fertileEstimate: null };
  const showWindow =
    prediction != null &&
    (prediction.state === 'upcoming' || prediction.state === 'window') &&
    prediction.earliest != null &&
    prediction.latest != null;

  return (day) => {
    const log = logs.get(day);
    const period = periods.some((p) => day >= p.startDate && day <= visibleLastDay(p, today));
    const bleeding = log && isBleeding(log.bleeding) ? log.bleeding : null;
    const logged = period || bleeding != null;

    return {
      period,
      bleeding,
      predicted:
        !logged &&
        showWindow &&
        day > today - MS_PER_SOLAR_DAY &&
        day >= prediction!.earliest! &&
        day <= prediction!.latest!,
      fertile: !!fertileEstimate && day >= fertileEstimate.start && day <= fertileEstimate.end,
      observation:
        !!log &&
        (log.symptoms.length > 0 ||
          log.noSymptoms ||
          log.pain != null ||
          log.energy != null ||
          log.note.trim() !== ''),
    };
  };
}

export type MarkerDescriptor =
  | { kind: 'period' }
  | { kind: 'bleeding'; level: BleedingLevel }
  | { kind: 'predicted' }
  | { kind: 'fertile' }
  | { kind: 'observation' };

/** What to say about a day, in order, for an accessibility label. The UI translates each part. */
export function describeMarkers(markers: DayMarkers): MarkerDescriptor[] {
  const out: MarkerDescriptor[] = [];
  if (markers.bleeding) {
    out.push({ kind: 'bleeding', level: markers.bleeding });
  }

  if (markers.period && !markers.bleeding) {
    out.push({ kind: 'period' });
  }

  if (markers.predicted) {
    out.push({ kind: 'predicted' });
  }

  if (markers.fertile) {
    out.push({ kind: 'fertile' });
  }

  if (markers.observation) {
    out.push({ kind: 'observation' });
  }

  return out;
}
