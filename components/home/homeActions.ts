import {
  Camera,
  Dumbbell,
  Flame,
  LucideIcon,
  NotebookPen,
  ScanLine,
  UtensilsCrossed,
  Weight
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
    icon: UtensilsCrossed, // You could reuse UtensilsCrossed or something similar
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
