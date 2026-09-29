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
import { HomeActionKey } from '@/constants/homeActions';

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
export function orderHomeActionRows(
  selected: readonly HomeActionKey[],
  available: readonly HomeActionKey[]
): HomeActionKey[] {
  return [
    ...selected.filter((key) => available.includes(key)),
    ...available.filter((key) => !selected.includes(key)),
  ];
}
