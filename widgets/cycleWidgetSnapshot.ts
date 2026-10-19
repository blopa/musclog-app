import type { AppLockScope, CycleNotificationStyle } from '@/constants/settings';
import { isCycleLockProtected } from '@/utils/appLockState';
import type { CycleTimeline } from '@/utils/cycle/cycleTimeline';
import type { CyclePeriodDto } from '@/utils/cycle/types';
import { formatAppInteger } from '@/utils/formatAppNumber';

import { INITIAL_WIDGET_PALETTE, type WidgetPalette } from './widgetSnapshot';

export type CycleWidgetSnapshot = {
  title: string;
  /** The day count; empty whenever the widget has nothing it may show. */
  value: string;
  caption: string;
  /** The estimate line, detailed style only. */
  detail: string;
  palette: WidgetPalette;
  refreshMessage: string;
  url: string;
};

/** What the loader read; `cycle` is null when it was not allowed to, or there is nothing to read. */
export type CycleWidgetInputs = {
  lockScopes: readonly AppLockScope[];
  style: CycleNotificationStyle;
  cycle: { timeline: CycleTimeline; activePeriod: CyclePeriodDto | null } | null;
};

export const CYCLE_WIDGET_URL = 'com.werules.logger://?action=open-cycle';

/** The widget's brand line when it must not say what it is about; same as the discreet notification. */
const NEUTRAL_TITLE = 'Musclog';

export const INITIAL_CYCLE_SNAPSHOT: CycleWidgetSnapshot = {
  title: NEUTRAL_TITLE,
  value: '',
  caption: 'Open Musclog to refresh',
  detail: '',
  palette: INITIAL_WIDGET_PALETTE,
  refreshMessage: 'Open Musclog to refresh',
  url: CYCLE_WIDGET_URL,
};

/**
 * How much the widget may say. A home screen is readable without unlocking the phone, let alone
 * the app, so ANY app lock forces the neutral style no matter what the person picked; the style
 * only decides anything while no lock is on. The whole-app lock counts too, and the locks on the
 * workout, nutrition and progress areas do not: `scopeRequiresLock` answers "does this SCREEN
 * ask", but a widget is not a screen.
 */
export function effectiveCycleWidgetStyle(
  lockScopes: readonly AppLockScope[],
  style: CycleNotificationStyle
): CycleNotificationStyle {
  return isCycleLockProtected(lockScopes) ? 'discreet' : style;
}

/** Whether the loader needs to read (and decrypt) cycle records at all. */
export function cycleWidgetNeedsRecords(
  lockScopes: readonly AppLockScope[],
  style: CycleNotificationStyle
): boolean {
  return effectiveCycleWidgetStyle(lockScopes, style) !== 'discreet';
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function estimateLine(
  { timeline, activePeriod }: NonNullable<CycleWidgetInputs['cycle']>,
  locale: string,
  translate: Translate
): string {
  const { prediction } = timeline;
  // The same states the cycle screen shows a date for; while a period is going the next one is
  // not the news.
  if (activePeriod) {
    return '';
  }

  if (prediction.state === 'late') {
    return translate('cycle.late.title', { count: prediction.daysLate });
  }

  if (
    (prediction.state === 'upcoming' || prediction.state === 'window') &&
    prediction.earliest != null &&
    prediction.latest != null
  ) {
    const format = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
    const from = format.format(prediction.earliest);
    const to = format.format(prediction.latest);

    return from === to
      ? translate('cycle.prediction.likelyDate', { date: from })
      : translate('cycle.prediction.likelyRange', { from, to });
  }

  return '';
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
  translate: Translate;
}): CycleWidgetSnapshot {
  const refreshMessage = translate('widgets.refresh');
  const base = {
    title: NEUTRAL_TITLE,
    value: '',
    detail: '',
    palette,
    refreshMessage,
    url: CYCLE_WIDGET_URL,
  };
  const style = effectiveCycleWidgetStyle(inputs.lockScopes, inputs.style);
  if (style === 'discreet') {
    return { ...base, caption: translate('widgets.cycle.privateCaption') };
  }

  const { cycle } = inputs;
  if (!cycle || cycle.timeline.elapsedDay == null) {
    return { ...base, caption: refreshMessage };
  }

  const value = formatAppInteger(locale, cycle.timeline.elapsedDay);
  if (style === 'subtle') {
    return { ...base, value, caption: translate('widgets.cycle.day') };
  }

  return {
    ...base,
    title: translate('widgets.cycle.title'),
    value,
    caption: translate('widgets.cycle.day'),
    detail: estimateLine(cycle, locale, translate),
  };
}

/** What the home screen keeps after midnight: yesterday's day count is no longer true. */
export function expiredCycleWidgetSnapshot(snapshot: CycleWidgetSnapshot): CycleWidgetSnapshot {
  if (snapshot.value === '') {
    return snapshot;
  }

  return {
    ...snapshot,
    title: NEUTRAL_TITLE,
    value: '',
    detail: '',
    caption: snapshot.refreshMessage,
  };
}
