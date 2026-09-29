export const HOME_ACTION_KEYS = [
  'start_workout',
  'track_food',
  'scan_barcode',
  'ai_photo',
  'log_weight',
  'my_meals',
  'add_note',
  'log_cardio',
] as const;

export type HomeActionKey = (typeof HOME_ACTION_KEYS)[number];

/** The home screen grid is two per row, so it fills exactly at this many quick actions. */
export const MAX_HOME_ACTIONS = 4;

/**
 * ...and a home screen with a single action looks broken, so the picker refuses to go
 * below this. Both bounds live here rather than in the picker because `parseHomeActions`
 * is what a stored value predating them (or hand-edited, or written by an older build)
 * has to survive.
 */
export const MIN_HOME_ACTIONS = 2;

export const DEFAULT_HOME_ACTIONS: readonly HomeActionKey[] = ['start_workout', 'track_food'];

export function parseHomeActions(raw: string | null | undefined): HomeActionKey[] {
  if (!raw) {
    return [...DEFAULT_HOME_ACTIONS];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_HOME_ACTIONS];
    }

    const validActions = parsed.filter(
      (key: any): key is HomeActionKey =>
        typeof key === 'string' && HOME_ACTION_KEYS.includes(key as HomeActionKey)
    );

    const uniqueActions = Array.from(new Set(validActions));

    if (uniqueActions.length < MIN_HOME_ACTIONS) {
      return [...DEFAULT_HOME_ACTIONS];
    }

    return uniqueActions.slice(0, MAX_HOME_ACTIONS);
  } catch (_e) {
    return [...DEFAULT_HOME_ACTIONS];
  }
}

/**
 * Add or remove one action, honouring both bounds.
 *
 * Selection order IS display order — a newly picked action lands at the end of the home
 * row — which is why this appends rather than restoring the canonical position. Removing
 * and re-picking is therefore how the user moves an action to the back.
 *
 * Returns the SAME array reference when a bound refuses the change, so a caller can tell
 * a no-op from a real edit without re-deriving the rule.
 */
export function toggleHomeAction(
  selected: readonly HomeActionKey[],
  key: HomeActionKey
): HomeActionKey[] {
  if (selected.includes(key)) {
    if (selected.length <= MIN_HOME_ACTIONS) {
      return selected as HomeActionKey[];
    }
    return selected.filter((k) => k !== key);
  }

  if (selected.length >= MAX_HOME_ACTIONS) {
    return selected as HomeActionKey[];
  }

  return [...selected, key];
}
