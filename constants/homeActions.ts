export const HOME_ACTION_KEYS = [
  'start_workout',
  'track_food',
  'scan_barcode',
  'ai_photo',
  'my_meals',
  'add_note',
] as const;

export type HomeActionKey = (typeof HOME_ACTION_KEYS)[number];

/** The home screen grid is two per row, so it fills exactly at this many quick actions. */
export const HOME_ACTIONS_PER_ROW = 2;
export const MAX_HOME_ACTIONS = HOME_ACTIONS_PER_ROW * 2;

/**
 * ...and a home screen with a single action looks broken, so the picker refuses to go
 * below this. Both bounds live here rather than in the picker because `parseHomeActions`
 * is what a stored value predating them (or hand-edited, or written by an older build)
 * has to survive.
 */
export const MIN_HOME_ACTIONS = HOME_ACTIONS_PER_ROW;

export const DEFAULT_HOME_ACTIONS: readonly HomeActionKey[] = ['start_workout', 'track_food'];

function isHomeActionKey(value: unknown): value is HomeActionKey {
  return typeof value === 'string' && (HOME_ACTION_KEYS as readonly string[]).includes(value);
}

export function parseHomeActions(raw: null | string | undefined): HomeActionKey[] {
  if (!raw) {
    return [...DEFAULT_HOME_ACTIONS];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_HOME_ACTIONS];
    }

    const uniqueActions = Array.from(new Set(parsed.filter(isHomeActionKey)));

    if (uniqueActions.length < MIN_HOME_ACTIONS) {
      return [...DEFAULT_HOME_ACTIONS];
    }

    return uniqueActions.slice(0, MAX_HOME_ACTIONS);
  } catch {
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
): readonly HomeActionKey[] {
  if (selected.includes(key)) {
    if (selected.length <= MIN_HOME_ACTIONS) {
      return selected;
    }
    return selected.filter((k) => k !== key);
  }

  if (selected.length >= MAX_HOME_ACTIONS) {
    return selected;
  }

  return [...selected, key];
}
