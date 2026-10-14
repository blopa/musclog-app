import type { TFunction } from 'i18next';
import { z } from 'zod';

import { SYMPTOM_LABEL_KEYS } from '@/constants/cycle';

export const CYCLE_GOALS = ['timing', 'symptoms', 'mood', 'record'] as const;
export const OBSERVATION_FIELDS = [
  'sleepHours',
  'temperatureC',
  'discharge',
  'medication',
  'sex',
  'tags',
  'impact',
  'leakage',
  'clots',
  'lhTest',
  'pregnancyTest',
] as const;

/** Whole keys per field, so `check-translations` sees them and a new field must declare one. */
export const OBSERVATION_FIELD_LABEL_KEYS: Record<(typeof OBSERVATION_FIELDS)[number], string> = {
  sleepHours: 'cycle.personalize.fields.sleepHours',
  temperatureC: 'cycle.personalize.fields.temperatureC',
  discharge: 'cycle.personalize.fields.discharge',
  medication: 'cycle.personalize.fields.medication',
  sex: 'cycle.personalize.fields.sex',
  tags: 'cycle.personalize.fields.tags',
  impact: 'cycle.personalize.fields.impact',
  leakage: 'cycle.personalize.fields.leakage',
  clots: 'cycle.personalize.fields.clots',
  lhTest: 'cycle.personalize.fields.lhTest',
  pregnancyTest: 'cycle.personalize.fields.pregnancyTest',
};

export const customFieldSchema = z
  .object({
    id: z.string().min(1).max(100),
    label: z.string().trim().min(1).max(60),
    kind: z.enum(['text', 'number', 'toggle', 'rating']),
    min: z.number().int().min(-100).max(100).optional(),
    max: z.number().int().min(-100).max(100).optional(),
  })
  .strict()
  .superRefine((field, ctx) => {
    if (field.kind === 'rating' && (field.min ?? 0) >= (field.max ?? 10)) {
      ctx.addIssue({ code: 'custom', message: 'invalid_rating_bounds' });
    }

    if (field.kind !== 'rating' && (field.min != null || field.max != null)) {
      ctx.addIssue({ code: 'custom', message: 'unexpected_rating_bounds' });
    }
  });
export const healthObservationSchema = z
  .object({
    id: z.string().min(1).max(200),
    source: z.enum(['health_connect', 'healthkit']),
    kind: z.enum(['bleeding', 'temperatureC']),
    value: z.union([z.string().max(100), z.number().min(30).max(45)]),
  })
  .strict()
  .superRefine((observation, ctx) => {
    if (
      observation.kind === 'temperatureC'
        ? typeof observation.value !== 'number'
        : !['none', 'spotting', 'light', 'medium', 'heavy', 'very_heavy'].includes(
            String(observation.value)
          )
    ) {
      ctx.addIssue({ code: 'custom', message: 'invalid_health_value' });
    }
  });
export const observationsSchema = z
  .object({
    impact: z.number().int().min(0).max(3).optional(),
    leakage: z.boolean().optional(),
    clots: z.boolean().optional(),
    lhTest: z.enum(['negative', 'positive', 'unclear']).optional(),
    pregnancyTest: z.enum(['negative', 'positive', 'unclear']).optional(),
    health: z.array(healthObservationSchema).max(100).optional(),
    sleepHours: z.number().min(0).max(24).optional(),
    temperatureC: z.number().min(30).max(45).optional(),
    discharge: z.string().max(200).optional(),
    medication: z.string().max(500).optional(),
    sex: z.boolean().optional(),
    tags: z.string().max(200).optional(),
    customLabels: z.record(z.string().max(100), z.string().max(60)).optional(),
    custom: z
      .record(
        z.string().min(1).max(100),
        z.union([z.string().max(500), z.number().finite(), z.boolean()])
      )
      .optional(),
  })
  .strict();
export const cycleConfigSchema = z
  .object({
    cycleLengthKnown: z.boolean().optional(),
    backupReminderDays: z.number().int().min(0).max(365).optional(),
    reminders: z
      .object({
        hour: z.number().int().min(0).max(23),
        minute: z.number().int().min(0).max(59),
        leadDays: z.number().int().min(0).max(14),
        period: z.boolean(),
        fertility: z.boolean(),
        daily: z.boolean(),
        endCheck: z.boolean(),
        due: z.boolean().optional(),
        late: z.boolean().optional(),
        pill: z
          .object({
            enabled: z.boolean(),
            hour: z.number().int().min(0).max(23),
            minute: z.number().int().min(0).max(59),
            packStart: z.number().int(),
            activeDays: z.number().int().min(1).max(365),
            breakDays: z.number().int().min(0).max(14),
          })
          .strict()
          .optional(),
        pause: z.object({ until: z.number().int().nullable() }).strict().nullable().optional(),
      })
      .strict()
      .optional(),
    fallbackCycleLength: z.number().int().min(15).max(120),
    fallbackPeriodDuration: z.number().int().min(1).max(30),
    quickLog: z.array(z.string().min(1).max(100)).max(6).optional(),
    pinSuggested: z.array(z.string().min(1).max(100)).max(100).optional(),
    goals: z.array(z.enum(CYCLE_GOALS)).max(4).optional(),
    customSymptoms: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    enabledFields: z.array(z.enum(OBSERVATION_FIELDS)).max(11).optional(),
    customFields: z.array(customFieldSchema).max(20).optional(),
  })
  .strict();

export function cycleSymptomLabel(key: string, t: TFunction): string {
  if (key.startsWith('custom:')) {
    return key.slice(7);
  }

  return SYMPTOM_LABEL_KEYS[key] ? t(SYMPTOM_LABEL_KEYS[key]) : key.replace(/_/g, ' ');
}

export function toggleChoice<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
