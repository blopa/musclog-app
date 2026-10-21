/**
 * Plain period shape the pure cycle modules work on. It is deliberately not the WatermelonDB
 * model, so the same maths runs over decrypted rows later and in the Jest `node` project today.
 */
export type PeriodEndKind = 'open' | 'logged' | 'estimated' | 'unknown';

export interface CyclePeriodInput {
  /** Local midnight ms of the first bleeding day. */
  startDate: number;
  /** Local midnight ms of the last bleeding day (inclusive); null while the period is open. */
  endDate: number | null;
  endKind?: PeriodEndKind;
  excludedFromStats?: boolean;
  /** Confirms a genuine long cycle; never bypasses physiology/context exclusions. */
  confirmedLongCycle?: boolean;
}

export type CycleExclusionReason =
  | 'too_short'
  | 'possible_missed_period'
  | 'user_excluded'
  | 'hormonal_context'
  | 'postpartum_context'
  | 'life_context';

export interface CycleHistoryEntry {
  start: number;
  /** Start of the following period; absent for the cycle still in progress. */
  nextStart?: number;
  lengthDays?: number;
  durationDays?: number;
  /** True only when the end date was actually logged by the user. */
  durationKnown: boolean;
  status: 'used' | 'excluded' | 'in_progress';
  reason?: CycleExclusionReason;
}

export type PredictionConfidence = 'none' | 'low' | 'moderate' | 'high';
export type CycleVariability = 'regular' | 'variable' | 'highly_variable';

// ── Decrypted record shapes ─────────────────────────────────────────────────────────────────
// What the encrypted `payload` columns hold. The rest of the app only ever sees these.

export type BleedingLevel = 'none' | 'spotting' | 'light' | 'medium' | 'heavy' | 'very_heavy';
export type SymptomSeverity = 1 | 2 | 3;

export interface CyclePeriodDto extends CyclePeriodInput {
  id: string;
  cycleId: string;
  endKind: PeriodEndKind;
  timezone: string;
  excludedFromStats: boolean;
  note: string;
}

export interface DaySymptom {
  key: string;
  /** Null = present but not rated, which is what a converted legacy symptom is. */
  severity: SymptomSeverity | null;
}

export interface CycleDayLogDto {
  id: string;
  /** Local midnight ms of the day this describes. */
  date: number;
  timezone: string;
  /** Null = bleeding not logged that day; `none` = explicitly no bleeding. */
  bleeding: BleedingLevel | null;
  symptoms: DaySymptom[];
  /** True = the user said "no symptoms today", which is different from not logging. */
  noSymptoms: boolean;
  pain: number | null;
  energy: number | null;
  note: string;
  /** Optional observations added after v36; older payloads omit these. */
  observations?: CycleObservations;
}

export type CycleGoal = 'timing' | 'symptoms' | 'mood' | 'record';
export type ObservationField =
  | 'sleepHours'
  | 'temperatureC'
  | 'discharge'
  | 'medication'
  | 'sex'
  | 'tags'
  | 'impact'
  | 'leakage'
  | 'clots'
  | 'lhTest'
  | 'pregnancyTest';
export interface CustomCycleField {
  id: string;
  label: string;
  kind: 'text' | 'number' | 'toggle' | 'rating';
  min?: number;
  max?: number;
}
export interface CycleObservations {
  impact?: number;
  leakage?: boolean;
  clots?: boolean;
  lhTest?: 'negative' | 'positive' | 'unclear';
  pregnancyTest?: 'negative' | 'positive' | 'unclear';
  /** Imported health observations remain separate from self-report. */
  health?: HealthCycleObservation[];
  sleepHours?: number;
  temperatureC?: number;
  discharge?: string;
  medication?: string;
  /** What the pill reminder's buttons recorded for the day; absent = no answer. */
  pill?: 'taken' | 'skipped';
  sex?: boolean;
  tags?: string;
  custom?: Record<string, string | number | boolean>;
  customLabels?: Record<string, string>;
}

export const CONTRACEPTION_METHOD_KEYS = [
  'none',
  'combined_pill',
  'progestin_pill',
  'pill_unspecified',
  'hormonal_iud',
  'copper_iud',
  'iud_unspecified',
  'implant',
  'patch',
  'ring',
  'injection',
  'other',
] as const;
export type ContraceptionMethod = (typeof CONTRACEPTION_METHOD_KEYS)[number];

export const CYCLE_LIFE_STAGES = [
  'regular',
  'pcos',
  'perimenopause',
  'postpartum',
  'post_pill',
  'no_bleeding',
  'pregnancy',
  'pregnancy_loss',
  'hysterectomy',
  'menopause',
] as const;
export type CycleLifeStage = (typeof CYCLE_LIFE_STAGES)[number];

export interface CycleContextDto {
  id: string;
  cycleId: string;
  /** Local midnight ms from which this context applies. */
  effectiveFrom: number;
  timezone: string;
  lifeStage: CycleLifeStage;
  contraception: ContraceptionMethod;
  note: string;
}

export interface CycleConfig {
  /** False means the user does not know; no fallback date is presented as learned history. */
  cycleLengthKnown?: boolean;
  reminders?: CycleReminderPreferences;
  backupReminderDays?: number;
  fallbackCycleLength: number;
  fallbackPeriodDuration: number;
  goals?: CycleGoal[];
  customSymptoms?: string[];
  enabledFields?: ObservationField[];
  customFields?: CustomCycleField[];
  quickLog?: string[];
  pinSuggested?: string[];
}

export interface CycleReminderPreferences {
  hour: number;
  minute: number;
  leadDays: number;
  period: boolean;
  fertility: boolean;
  daily: boolean;
  endCheck: boolean;
  /** On the most likely start day. Optional: absent in configs saved before it existed. */
  due?: boolean;
  /** The day after the latest plausible start, in neutral wording ("longer than usual"). */
  late?: boolean;
  pill?: PillSchedule;
  /** Silences every cycle reminder except the pill until `until` (null: until resumed). */
  pause?: { until: number | null } | null;
}

/**
 * A daily pill reminder that knows the pack. `breakDays: 0` is continuous use (no pill-free
 * days); 21/7 and 24/4 skip the reminder on the pill-free days instead of nagging through them.
 */
export interface PillSchedule {
  enabled: boolean;
  hour: number;
  minute: number;
  /** Local midnight ms of the first pill of a pack. */
  packStart: number;
  activeDays: number;
  breakDays: number;
}

export interface HealthCycleObservation {
  id: string;
  source: 'health_connect' | 'healthkit';
  kind: 'bleeding' | 'temperatureC';
  value: string | number;
}

/** Preference edits merge with the latest config inside the database writer. */
export type CycleConfigPatch = Omit<Partial<CycleConfig>, 'reminders'> & {
  reminders?: Partial<CycleReminderPreferences>;
};
export type CycleConfigUpdate = CycleConfigPatch | ((current: CycleConfig) => CycleConfigPatch);
