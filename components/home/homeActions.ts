import {
  BookOpen,
  Camera,
  Dumbbell,
  Flame,
  LucideIcon,
  NotebookPen,
  ScanLine,
  UtensilsCrossed,
  Weight,
} from 'lucide-react-native';

import { ActionButtonTone } from '@/components/ActionButton';
import { DEFAULT_HOME_ACTIONS, HomeActionKey, MIN_HOME_ACTIONS } from '@/constants/homeActions';

export type HomeActionConfig = {
  labelKey: string;
  icon: LucideIcon;
  tone: ActionButtonTone;
};

export const HOME_ACTIONS: Record<HomeActionKey, HomeActionConfig> = {
  start_workout: {
    labelKey: 'home.actions.startWorkout',
    icon: Dumbbell,
    tone: 'workout',
  },
  track_food: {
    labelKey: 'home.actions.trackFood',
    icon: UtensilsCrossed,
    tone: 'food',
  },
  scan_barcode: {
    labelKey: 'home.actions.scanBarcode',
    icon: ScanLine,
    tone: 'neutral',
  },
  ai_photo: {
    labelKey: 'home.actions.aiPhoto',
    icon: Camera,
    tone: 'accent',
  },
  log_weight: {
    labelKey: 'home.actions.logWeight',
    icon: Weight,
    tone: 'neutral',
  },
  my_meals: {
    labelKey: 'home.actions.myMeals',
    icon: BookOpen,
    tone: 'neutral',
  },
  add_note: {
    labelKey: 'home.actions.addNote',
    icon: NotebookPen,
    tone: 'neutral',
  },
  log_cardio: {
    labelKey: 'home.actions.logCardio',
    icon: Flame,
    tone: 'accent',
  },
};

type IsHomeActionAvailableOptions = {
  isAiConfigured: boolean;
  platform: 'ios' | 'android' | 'web' | string;
};

export function isHomeActionAvailable(
  key: HomeActionKey,
  { isAiConfigured, platform }: IsHomeActionAvailableOptions
): boolean {
  if (key === 'ai_photo') {
    return isAiConfigured && platform !== 'web';
  }

  if (key === 'scan_barcode') {
    return platform !== 'web';
  }

  if (key === 'log_cardio') {
    return false; // Hidden until plan 08 ships
  }

  // The app has no weight-entry UI to send this anywhere: the only way to record a weight
  // is Profile -> Edit Fitness Details, a seven-field form. The action shipped wired to the
  // Day Summary goals menu, which is not what its label promises, so it stays hidden until
  // it has a destination of its own.
  if (key === 'log_weight') {
    return false;
  }

  return true;
}

/**
 * The home tile's label is deliberately two lines ("Track\nFood") so it fits the square
 * button. A settings list row is one line, so the break collapses to a space here rather
 * than every locale carrying a second copy of the same two words.
 */
export function homeActionListLabel(label: string): string {
  return label.replace(/\n/g, ' ');
}

/**
 * Order the picker's rows: chosen actions first, in the order they were picked, then the
 * rest in the catalogue's own order.
 *
 * The chosen block therefore reads exactly as the home row does, which is what makes the
 * position badges meaningful. A stored action this device cannot offer (an AI action
 * after the provider was removed, a camera action on web) is dropped, so the list never
 * advertises a button the home screen would filter out anyway.
 */
/**
 * Drop chosen actions this device cannot offer, then top up to `MIN_HOME_ACTIONS` from the
 * ones it can.
 *
 * A stored selection outlives its own availability: the AI provider gets removed, the same
 * database is opened on web where the camera actions do not exist, or an action is retired
 * from the catalogue entirely (`log_weight`, until it has somewhere to go). Filtering alone
 * would leave the home row below its floor and the picker showing fewer chosen rows than
 * its counter claims, so the gap is filled rather than left.
 */
export function reconcileHomeActions(
  selected: readonly HomeActionKey[],
  available: readonly HomeActionKey[]
): HomeActionKey[] {
  const kept = selected.filter((key) => available.includes(key));
  // Same-reference-means-unchanged, as `toggleHomeAction` does, so a caller can tell a
  // reconciliation that needs persisting from one that does not.
  if (kept.length >= MIN_HOME_ACTIONS) {
    return kept.length === selected.length ? (selected as HomeActionKey[]) : kept;
  }

  // Defaults first, so a topped-up row looks like a fresh install rather than whatever
  // happens to sort earliest in the catalogue.
  const topUp = [...new Set([...DEFAULT_HOME_ACTIONS, ...available])].filter(
    (key) => available.includes(key) && !kept.includes(key)
  );

  return [...kept, ...topUp].slice(0, MIN_HOME_ACTIONS);
}

export function orderHomeActionRows(
  selected: readonly HomeActionKey[],
  available: readonly HomeActionKey[]
): HomeActionKey[] {
  return [
    ...selected.filter((key) => available.includes(key)),
    ...available.filter((key) => !selected.includes(key)),
  ];
}
