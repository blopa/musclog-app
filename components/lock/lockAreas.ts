import { Apple, BarChart3, Calendar, Dumbbell, Lock } from 'lucide-react-native';
import type { ComponentType } from 'react';

import type { AppLockScope } from '@/constants/settings';

type LockAreaCopy = {
  icon: ComponentType<{ size?: number; color?: string }>;
  /** The toggle in settings and what it covers. */
  labelKey: string;
  hintKey: string;
  /** What the lock screen says in place of the area's content. `app` has the full-screen cover. */
  lockedTitleKey: string;
  lockedDescriptionKey: string;
};

/**
 * Whole-key tables rather than `t(`lock.areas.${scope}.label`)`, so `check-translations` and a
 * grep for a key both see them. A `Record`, so a new scope fails the build until it has copy.
 */
export const LOCK_AREA_COPY: Record<AppLockScope, LockAreaCopy> = {
  app: {
    icon: Lock,
    labelKey: 'lock.areas.app.label',
    hintKey: 'lock.areas.app.hint',
    lockedTitleKey: 'cycle.lock.appTitle',
    lockedDescriptionKey: 'cycle.lock.appDescription',
  },
  cycle: {
    icon: Calendar,
    labelKey: 'lock.areas.cycle.label',
    hintKey: 'lock.areas.cycle.hint',
    lockedTitleKey: 'lock.areas.cycle.lockedTitle',
    lockedDescriptionKey: 'lock.areas.cycle.lockedDescription',
  },
  workout: {
    icon: Dumbbell,
    labelKey: 'lock.areas.workout.label',
    hintKey: 'lock.areas.workout.hint',
    lockedTitleKey: 'lock.areas.workout.lockedTitle',
    lockedDescriptionKey: 'lock.areas.workout.lockedDescription',
  },
  nutrition: {
    icon: Apple,
    labelKey: 'lock.areas.nutrition.label',
    hintKey: 'lock.areas.nutrition.hint',
    lockedTitleKey: 'lock.areas.nutrition.lockedTitle',
    lockedDescriptionKey: 'lock.areas.nutrition.lockedDescription',
  },
  progress: {
    icon: BarChart3,
    labelKey: 'lock.areas.progress.label',
    hintKey: 'lock.areas.progress.hint',
    lockedTitleKey: 'lock.areas.progress.lockedTitle',
    lockedDescriptionKey: 'lock.areas.progress.lockedDescription',
  },
};
