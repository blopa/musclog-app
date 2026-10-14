export type PeriodLogMode = 'start' | 'end' | 'past';

export const DEFAULT_PERIOD_DURATION = 5;

export const FLOW_LEVELS = [1, 2, 3, 4, 5] as const;

export const FLOW_LEVEL_KEYS: Record<number, string> = {
  1: 'cycle.flow.spotting',
  2: 'cycle.flow.light',
  3: 'cycle.flow.medium',
  4: 'cycle.flow.heavy',
  5: 'cycle.flow.veryHeavy',
};

export const PHYSICAL_SYMPTOM_KEYS: { key: string; value: string }[] = [
  { key: 'cycle.symptoms.cramps', value: 'cramps' },
  { key: 'cycle.symptoms.bloating', value: 'bloating' },
  { key: 'cycle.symptoms.breastTenderness', value: 'breast_tenderness' },
  { key: 'cycle.symptoms.headache', value: 'headache' },
  { key: 'cycle.symptoms.migraine', value: 'migraine' },
  { key: 'cycle.symptoms.nausea', value: 'nausea' },
  { key: 'cycle.symptoms.backPain', value: 'back_pain' },
  { key: 'cycle.symptoms.fatigue', value: 'fatigue' },
  { key: 'cycle.symptoms.acne', value: 'acne' },
  { key: 'cycle.symptoms.foodCravings', value: 'food_cravings' },
  { key: 'cycle.symptoms.digestiveIssues', value: 'digestive_issues' },
  { key: 'cycle.symptoms.hotFlashes', value: 'hot_flashes' },
  { key: 'cycle.symptoms.insomnia', value: 'insomnia' },
];

export const EMOTIONAL_SYMPTOM_KEYS: { key: string; value: string }[] = [
  { key: 'cycle.symptoms.moodSwings', value: 'mood_swings' },
  { key: 'cycle.symptoms.anxiety', value: 'anxiety' },
  { key: 'cycle.symptoms.irritability', value: 'irritability' },
  { key: 'cycle.symptoms.lowMood', value: 'low_mood' },
  { key: 'cycle.symptoms.brainFog', value: 'brain_fog' },
  { key: 'cycle.symptoms.lowLibido', value: 'low_libido' },
];

/** Shortest interval between two period starts that is treated as a real cycle (days). */
export const MIN_PLAUSIBLE_CYCLE_DAYS = 15;
/** A cycle this many times the median of the others is flagged as a possibly missed period. */
export const MISSED_PERIOD_RATIO = 1.8;
/** Only this many of the most recent usable cycles feed predictions. */
export const MAX_CYCLES_FOR_STATS = 12;
/** Spread (longest - shortest usable cycle, days) up to which cycles count as regular (ACOG). */
export const REGULAR_SPREAD_MAX_DAYS = 9;
/** Spread above which a single predicted date is not meaningful. */
export const HIGHLY_VARIABLE_SPREAD_DAYS = 20;
export const MIN_CYCLES_MODERATE_CONFIDENCE = 2;
export const MIN_CYCLES_HIGH_CONFIDENCE = 4;
/** The luteal phase (ovulation to next period) is the steadiest part of the cycle. */
export const LUTEAL_PHASE_DAYS = 14;
export const OVULATORY_HALF_WINDOW_DAYS = 2;

/** A period still "open" this long after it started was forgotten, not ongoing. */
export const STALE_OPEN_PERIOD_DAYS = 14;
/** Reminder lead time: the period reminder fires this many days before the predicted start. */
export const PERIOD_REMINDER_LEAD_DAYS = 2;

/** Symptom key (as stored) -> translation key, across both groups. */
export const SYMPTOM_LABEL_KEYS: Record<string, string> = Object.fromEntries(
  [...PHYSICAL_SYMPTOM_KEYS, ...EMOTIONAL_SYMPTOM_KEYS].map((option) => [option.value, option.key])
);

export const BLEEDING_LABEL_KEYS = {
  none: 'cycle.calendar.bleeding.none',
  spotting: 'cycle.calendar.bleeding.spotting',
  light: 'cycle.calendar.bleeding.light',
  medium: 'cycle.calendar.bleeding.medium',
  heavy: 'cycle.calendar.bleeding.heavy',
  very_heavy: 'cycle.calendar.bleeding.very_heavy',
} as const;

export const SEVERITY_LABEL_KEYS = {
  1: 'cycle.severity.mild',
  2: 'cycle.severity.moderate',
  3: 'cycle.severity.severe',
} as const;

/** Device-local bookkeeping; excluded from portable backups. */
export const CYCLE_BACKUP_STATUS_KEY = 'musclog_cycle_backup_prepared_at';
