import type { LifeStage } from '@/database/models/MenstrualCycle';
import type { PredictionConfidence } from '@/database/services/MenstrualService';

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

export const LIFE_STAGE_WARNING_KEYS: Partial<Record<LifeStage, string>> = {
  pcos: 'cycle.lifeStage.pcos',
  post_pill: 'cycle.lifeStage.postPill',
  postpartum: 'cycle.lifeStage.postpartum',
  perimenopause: 'cycle.lifeStage.perimenopause',
};

export const CONFIDENCE_LABEL_KEYS: Partial<Record<PredictionConfidence, string>> = {
  low: 'cycle.confidence.low',
  medium: 'cycle.confidence.medium',
  high: 'cycle.confidence.high',
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
