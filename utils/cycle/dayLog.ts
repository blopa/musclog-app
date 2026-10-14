import type { BleedingLevel, CycleDayLogDto, DaySymptom, SymptomSeverity } from './types';

export const BLEEDING_LEVELS: BleedingLevel[] = [
  'none',
  'spotting',
  'light',
  'medium',
  'heavy',
  'very_heavy',
];

/** Days with actual bleeding (spotting counts: it is what a user marks on the calendar). */
export function isBleeding(level: BleedingLevel | null | undefined): boolean {
  return level != null && level !== 'none';
}

export function isEmptyDayLog(
  log: Pick<CycleDayLogDto, 'bleeding' | 'symptoms' | 'noSymptoms' | 'pain' | 'energy' | 'note'> &
    Pick<Partial<CycleDayLogDto>, 'observations'>
): boolean {
  return (
    log.bleeding == null &&
    log.symptoms.length === 0 &&
    !log.noSymptoms &&
    log.pain == null &&
    log.energy == null &&
    log.note.trim() === '' &&
    Object.values(log.observations ?? {}).every(
      (value) =>
        value == null ||
        value === '' ||
        (typeof value === 'object' && Object.values(value).every((v) => v == null || v === ''))
    )
  );
}

/**
 * Tapping a symptom chip adds it (unrated: "present" is a complete answer) or removes it. It used
 * to step through mild -> moderate -> severe -> off, so taking back one tap took three more and
 * the only hint was a line of small print. Severity is a separate, optional choice.
 */
export function toggleSymptom(symptoms: DaySymptom[], key: string): DaySymptom[] {
  return symptoms.some((s) => s.key === key)
    ? symptoms.filter((s) => s.key !== key)
    : [...symptoms, { key, severity: null }];
}

/** Rate (or, with `null`, un-rate) a symptom already logged; tapping the chosen rating clears it. */
export function setSymptomSeverity(
  symptoms: DaySymptom[],
  key: string,
  severity: SymptomSeverity | null
): DaySymptom[] {
  return symptoms.map((s) =>
    s.key === key ? { key, severity: s.severity === severity ? null : severity } : s
  );
}

/** Choosing "no symptoms" and logging a symptom contradict each other, so one clears the other. */
export function withNoSymptoms(
  log: Pick<CycleDayLogDto, 'symptoms' | 'noSymptoms'>,
  noSymptoms: boolean
): Pick<CycleDayLogDto, 'symptoms' | 'noSymptoms'> {
  return noSymptoms
    ? { symptoms: [], noSymptoms: true }
    : { symptoms: log.symptoms, noSymptoms: false };
}

export const MAX_QUICK_LOG = 6;

export function parseQuickLog(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }

  return [
    ...new Set(
      raw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    ),
  ].slice(0, MAX_QUICK_LOG);
}

export function serializeQuickLog(keys: string[]): string {
  return [...new Set(keys)].slice(0, MAX_QUICK_LOG).join(',');
}

/** Pin on a full list is refused rather than silently evicting something the user chose. */
export function togglePinned(keys: string[], key: string): string[] {
  if (keys.includes(key)) {
    return keys.filter((k) => k !== key);
  }

  return keys.length >= MAX_QUICK_LOG ? keys : [...keys, key];
}

/** Symptoms logged on at least this many days in at least this many different cycles. */
export const PIN_SUGGESTION_MIN_DAYS = 3;
export const PIN_SUGGESTION_MIN_CYCLES = 2;

/**
 * A symptom worth offering to pin: logged often, across cycles, not pinned already and not
 * suggested before. `cycleStarts` are ascending period start days; a day belongs to the latest
 * start at or before it.
 */
export function suggestPin(
  dayLogs: Pick<CycleDayLogDto, 'date' | 'symptoms'>[],
  cycleStarts: number[],
  pinned: string[],
  alreadySuggested: string[]
): string | null {
  const stats = new Map<string, { days: number; cycles: Set<number> }>();
  for (const log of dayLogs) {
    const cycleStart = [...cycleStarts].reverse().find((s) => s <= log.date) ?? -1;
    for (const { key } of log.symptoms) {
      const entry = stats.get(key) ?? { days: 0, cycles: new Set<number>() };
      entry.days += 1;
      entry.cycles.add(cycleStart);
      stats.set(key, entry);
    }
  }

  const candidates = [...stats.entries()]
    .filter(
      ([key, v]) =>
        v.days >= PIN_SUGGESTION_MIN_DAYS &&
        v.cycles.size >= PIN_SUGGESTION_MIN_CYCLES &&
        !pinned.includes(key) &&
        !alreadySuggested.includes(key)
    )
    .sort((a, b) => b[1].days - a[1].days);

  return candidates[0]?.[0] ?? null;
}

/** An empty day to build a patch on, for a day nothing was logged on yet. */
export function blankDayLog(date: number): Omit<CycleDayLogDto, 'id' | 'timezone'> {
  return {
    date,
    bleeding: null,
    symptoms: [],
    noSymptoms: false,
    pain: null,
    energy: null,
    note: '',
  };
}

/** Applies a patch to a day, keeping everything it does not mention. */
export function patchDayLog(
  existing:
    | Pick<
        CycleDayLogDto,
        | 'date'
        | 'bleeding'
        | 'symptoms'
        | 'noSymptoms'
        | 'pain'
        | 'energy'
        | 'note'
        | 'observations'
      >
    | undefined,
  date: number,
  patch: Partial<Omit<CycleDayLogDto, 'id' | 'timezone' | 'date'>>
): Omit<CycleDayLogDto, 'id' | 'timezone'> {
  const base = existing
    ? {
        date,
        bleeding: existing.bleeding,
        symptoms: existing.symptoms,
        noSymptoms: existing.noSymptoms,
        pain: existing.pain,
        energy: existing.energy,
        note: existing.note,
        observations: existing.observations,
      }
    : blankDayLog(date);

  return { ...base, ...patch };
}
