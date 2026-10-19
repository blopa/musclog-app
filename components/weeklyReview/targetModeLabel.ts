import type { TFunction } from 'i18next';

import type { NutritionTargetMode } from '@/database/models/NutritionGoal';

export const TARGET_MODE_KEYS = {
  manual: 'weeklyReview.modes.manual',
  daily: 'weeklyReview.modes.daily',
  weekly: 'weeklyReview.modes.weekly',
} as const satisfies Record<NutritionTargetMode, string>;

/**
 * Where today's targets come from ("Weekly targets · since Oct 12"). Food shows it as the
 * supporting line of the Weekly Review entry in the summary card's menu.
 */
export function targetModeSummary(
  t: TFunction,
  locale: string,
  mode: NutritionTargetMode,
  effectiveFrom?: number
): string {
  const label = t(TARGET_MODE_KEYS[mode]);
  if (!effectiveFrom) {
    return label;
  }

  const since = t('weeklyReview.effective', {
    date: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(effectiveFrom),
  });

  return `${label} · ${since}`;
}
