import type { TFunction } from 'i18next';

import type { RestrictionKind } from '@/utils/exerciseSubstitution';

/**
 * Whole translation keys, not a suffix completed at the call site: `scripts/check-translations.js`
 * only sees literal keys, so a built-up `badge.${kind}` would read as unused and be deleted.
 */
const RESTRICTION_BADGE_KEYS = {
  never: 'workoutSettings.restrictions.badge.never',
  injury: 'workoutSettings.restrictions.badge.injury',
  dislike: 'workoutSettings.restrictions.badge.dislike',
} as const satisfies Record<RestrictionKind, string>;

/**
 * The secondary line of an exercise row, with the user's restriction on it (if any) appended —
 * "Chest • Compound • Injury". One place, so every exercise picker marks an avoided exercise the
 * same way.
 */
export function describeExerciseRow(
  base: string,
  restriction: RestrictionKind | undefined,
  t: TFunction
): string {
  return restriction ? `${base} • ${t(RESTRICTION_BADGE_KEYS[restriction])}` : base;
}
