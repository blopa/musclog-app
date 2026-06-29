import type { LifeStage } from '@/database/models/MenstrualCycle';
import type { PredictionConfidence } from '@/database/services/MenstrualService';

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
