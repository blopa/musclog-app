import {
  BookOpen,
  Camera,
  Dumbbell,
  LucideIcon,
  NotebookPen,
  ScanLine,
  UtensilsCrossed,
} from 'lucide-react-native';

import { ActionButtonTone } from '@/components/ActionButton';
import { DEFAULT_HOME_ACTIONS, HomeActionKey, MIN_HOME_ACTIONS } from '@/constants/homeActions';

/** What an action needs to know about this device to say whether it can be offered. */
export type HomeActionContext = {
  isAiConfigured: boolean;
  isWeb: boolean;
};

export type HomeActionConfig = {
  labelKey: string;
  icon: LucideIcon;
  tone: ActionButtonTone;
  /**
   * Whether this device can offer the action at all.
   *
   * Declared per entry rather than in an `if` chain so the compiler demands a decision for
   * every new key: a `Record<HomeActionKey, …>` with a required field cannot silently
   * default a newcomer to "always available" the way a fallthrough `return true` did.
   */
  isAvailable: (context: HomeActionContext) => boolean;
};

const ALWAYS = () => true;

export const HOME_ACTIONS: Record<HomeActionKey, HomeActionConfig> = {
  start_workout: {
    labelKey: 'home.actions.startWorkout',
    icon: Dumbbell,
    tone: 'accent',
    isAvailable: ALWAYS,
  },
  track_food: {
    labelKey: 'home.actions.trackFood',
    icon: UtensilsCrossed,
    tone: 'muted',
    isAvailable: ALWAYS,
  },
  scan_barcode: {
    labelKey: 'home.actions.scanBarcode',
    icon: ScanLine,
    tone: 'muted',
    // There is no camera to scan with on web.
    isAvailable: ({ isWeb }) => !isWeb,
  },
  ai_photo: {
    labelKey: 'home.actions.aiPhoto',
    icon: Camera,
    tone: 'accent',
    // Gated on the provider per the AI-affordance rule: an action inside a menu or a grid
    // must not advertise AI, because tapping it would dead-end.
    isAvailable: ({ isAiConfigured, isWeb }) => isAiConfigured && !isWeb,
  },
  my_meals: {
    labelKey: 'home.actions.myMeals',
    icon: BookOpen,
    tone: 'muted',
    isAvailable: ALWAYS,
  },
  add_note: {
    labelKey: 'home.actions.addNote',
    icon: NotebookPen,
    tone: 'muted',
    isAvailable: ALWAYS,
  },
};

/**
 * The home tile's label is deliberately two lines ("Track\nFood") so it fits the square
 * button. A settings list row is one line, so the break collapses to a space here rather
 * than every locale carrying a second copy of the same two words.
 */
export function homeActionListLabel(label: string): string {
  return label.replace(/\n/g, ' ');
}

/**
 * Drop chosen actions this device cannot offer, then top up to `MIN_HOME_ACTIONS` from the
 * ones it can.
 *
 * A stored selection outlives its own availability: the AI provider gets removed, the same
 * database is opened on web where the camera actions do not exist, or an action is retired
 * from the catalogue entirely. Filtering alone would leave the home row below its floor and
 * the picker showing fewer chosen rows than its counter claims, so the gap is filled rather
 * than left.
 */
export function reconcileHomeActions(
  selected: readonly HomeActionKey[],
  available: readonly HomeActionKey[]
): readonly HomeActionKey[] {
  const kept = selected.filter((key) => available.includes(key));
  // Same-reference-means-unchanged, as `toggleHomeAction` does, so a caller can tell a
  // reconciliation that needs persisting from one that does not. The return stays
  // `readonly` precisely so that returning the caller's own array needs no cast.
  if (kept.length >= MIN_HOME_ACTIONS) {
    return kept.length === selected.length ? selected : kept;
  }

  // Defaults first, so a topped-up row looks like a fresh install rather than whatever
  // happens to sort earliest in the catalogue.
  const topUp = [...new Set([...DEFAULT_HOME_ACTIONS, ...available])].filter(
    (key) => available.includes(key) && !kept.includes(key)
  );

  return [...kept, ...topUp].slice(0, MIN_HOME_ACTIONS);
}

/**
 * Order the picker's rows: chosen actions first, in the order they were picked, then the
 * rest in the catalogue's own order.
 *
 * The chosen block therefore reads exactly as the home row does, which is what makes the
 * position badges meaningful.
 */
export function orderHomeActionRows(
  selected: readonly HomeActionKey[],
  available: readonly HomeActionKey[]
): readonly HomeActionKey[] {
  return [
    ...selected.filter((key) => available.includes(key)),
    ...available.filter((key) => !selected.includes(key)),
  ];
}
