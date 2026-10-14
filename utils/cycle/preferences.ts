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
] as const;

export const customFieldSchema = z
  .object({
    id: z.string().min(1).max(100),
    label: z.string().trim().min(1).max(60),
    kind: z.enum(['text', 'number', 'toggle']),
  })
  .strict();
export const observationsSchema = z
  .object({
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
    fallbackCycleLength: z.number().int().min(15).max(120),
    fallbackPeriodDuration: z.number().int().min(1).max(30),
    quickLog: z.array(z.string().min(1).max(100)).max(6).optional(),
    pinSuggested: z.array(z.string().min(1).max(100)).max(100).optional(),
    goals: z.array(z.enum(CYCLE_GOALS)).max(4).optional(),
    customSymptoms: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    enabledFields: z.array(z.enum(OBSERVATION_FIELDS)).max(6).optional(),
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
