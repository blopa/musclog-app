import type { AppLockScope } from '@/constants/settings';
import { isCycleLockProtected } from '@/utils/appLockState';
import { formatAppInteger } from '@/utils/formatAppNumber';

import { INITIAL_WIDGET_PALETTE, type WidgetPalette } from './widgetSnapshot';

/**
 * `day` shows the day count; `private` is the quiet brand shortcut a lock leaves; `stale` asks to
 * open the app. Only `day` carries a `value`, and only `day` shows it.
 */
export type CycleWidgetState = 'day' | 'private' | 'stale';

export type CycleWidgetSnapshot = {
  state: CycleWidgetState;
  title: string;
  value: string;
  caption: string;
  palette: WidgetPalette;
  refreshMessage: string;
  url: string;
};

/** What the loader read; `elapsedDay` is null when it was not allowed to, or there is no period. */
export type CycleWidgetInputs = {
  lockScopes: readonly AppLockScope[];
  elapsedDay: number | null;
};

export const CYCLE_WIDGET_URL = 'com.werules.logger://?action=open-cycle';

/** The widget's brand line; it never names what the widget is about. */
const NEUTRAL_TITLE = 'Musclog';

export const INITIAL_CYCLE_SNAPSHOT: CycleWidgetSnapshot = {
  state: 'stale',
  title: NEUTRAL_TITLE,
  value: '',
  caption: 'Open Musclog to refresh',
  palette: INITIAL_WIDGET_PALETTE,
  refreshMessage: 'Open Musclog to refresh',
  url: CYCLE_WIDGET_URL,
};

/**
 * Whether the widget may show the day count. A home screen is readable without unlocking the
 * phone, let alone the app, so a cycle or whole-app lock hides it; the locks on the workout,
 * nutrition and progress areas do not. `scopeRequiresLock` answers "does this SCREEN ask", but a
 * widget is not a screen.
 */
export function cycleWidgetMayShowDay(lockScopes: readonly AppLockScope[]): boolean {
  return !isCycleLockProtected(lockScopes);
}

export function buildCycleWidgetSnapshot({
  inputs,
  palette,
  locale,
  translate,
}: {
  inputs: CycleWidgetInputs;
  palette: WidgetPalette;
  locale: string;
  translate: (key: string) => string;
}): CycleWidgetSnapshot {
  const refreshMessage = translate('widgets.refresh');
  const base = { title: NEUTRAL_TITLE, value: '', palette, refreshMessage, url: CYCLE_WIDGET_URL };
  if (!cycleWidgetMayShowDay(inputs.lockScopes)) {
    return { ...base, state: 'private', caption: translate('widgets.cycle.privateCaption') };
  }

  if (inputs.elapsedDay == null) {
    return { ...base, state: 'stale', caption: refreshMessage };
  }

  return {
    ...base,
    state: 'day',
    value: formatAppInteger(locale, inputs.elapsedDay),
    caption: translate('widgets.cycle.day'),
  };
}

/** What the home screen keeps after midnight: yesterday's day count is no longer true. */
export function expiredCycleWidgetSnapshot(snapshot: CycleWidgetSnapshot): CycleWidgetSnapshot {
  if (snapshot.state !== 'day') {
    return snapshot;
  }

  return { ...snapshot, state: 'stale', value: '', caption: snapshot.refreshMessage };
}
