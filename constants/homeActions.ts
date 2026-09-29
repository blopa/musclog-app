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

const DEFAULT_HOME_ACTIONS: HomeActionKey[] = ['start_workout', 'track_food'];

export function parseHomeActions(raw: string | null | undefined): HomeActionKey[] {
  if (!raw) {
    return DEFAULT_HOME_ACTIONS;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_HOME_ACTIONS;
    }

    const validActions = parsed.filter((key: any): key is HomeActionKey =>
      typeof key === 'string' && HOME_ACTION_KEYS.includes(key as HomeActionKey)
    );

    const uniqueActions = Array.from(new Set(validActions));

    if (uniqueActions.length === 0) {
      return DEFAULT_HOME_ACTIONS;
    }

    return uniqueActions.slice(0, 4);
  } catch (_e) {
    return DEFAULT_HOME_ACTIONS;
  }
}
