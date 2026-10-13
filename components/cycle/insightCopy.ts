import type { TFunction } from 'i18next';

import { SYMPTOM_LABEL_KEYS } from '@/constants/cycle';
import type { Insight } from '@/utils/cycle/cycleInsights';

/** Whole translation keys per insight, never assembled at the call site. */
export function insightSentenceKey(insight: Insight): string {
  switch (insight.kind) {
    case 'recurring_symptom':
      return 'cycle.insights.recurringSymptom';
    case 'high_pain':
      return 'cycle.insights.highPain';
    case 'cycle_length':
      return insight.params.direction === 'longer'
        ? 'cycle.insights.cycleLengthLonger'
        : 'cycle.insights.cycleLengthShorter';
    case 'bleeding_duration':
      return insight.params.direction === 'longer'
        ? 'cycle.insights.durationLonger'
        : 'cycle.insights.durationShorter';
    case 'mood_near_start':
      return 'cycle.insights.moodNearStart';
    case 'workout_near_start':
      return 'cycle.insights.workoutNearStart';
  }
}

/**
 * The observation as a sentence in the person's language: numbers formatted for their locale and
 * a symptom key turned into its label.
 */
export function insightSentence(
  t: TFunction,
  insight: Insight,
  formatInteger: (n: number) => string
): string {
  const params: Record<string, string | number> = { ...insight.params };
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'number') {
      params[key] = formatInteger(value);
    }
  }

  if (typeof insight.params.symptom === 'string') {
    const labelKey = SYMPTOM_LABEL_KEYS[insight.params.symptom];
    params.symptom = (labelKey ? t(labelKey) : insight.params.symptom).toLowerCase();
  }

  return t(insightSentenceKey(insight), params);
}
