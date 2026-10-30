import type { TFunction } from 'i18next';

import type { CycleNotificationStyle } from '@/constants/settings';

import { cycleReminderContent } from './cycleReminderCopy';
import type { CycleReminderKind } from './cycleReminders';
import type { CycleTimeline } from './cycleTimeline';
import { addCalendarDays } from './dates';

/** What the OS reports about notification delivery (`CycleNotificationService`). */
export type DeliveryStatusInput = {
  permission: string;
  appEnabled: boolean;
  cycleEnabled: boolean;
};

/**
 * Whether cycle reminders can reach the user, as ONE value. The settings screen used to re-derive
 * this from `Platform.OS`, a nullable status and a `deliverable` flag in three places — the warning
 * tint, the "Turn on" button and the test send — each of which had to get the same three-way
 * combination right.
 *
 * - `web`: no local notifications at all.
 * - `unknown`: the status has not been read yet; say nothing either way.
 * - `noPermission` / `switchedOff`: blocked, by the OS permission or by a channel or app switch.
 * - `ok`: they will arrive.
 */
export type CycleDeliveryState = 'web' | 'unknown' | 'noPermission' | 'switchedOff' | 'ok';

export function cycleDeliveryState(
  isWeb: boolean,
  status: DeliveryStatusInput | null
): CycleDeliveryState {
  if (isWeb) {
    return 'web';
  }

  if (!status) {
    return 'unknown';
  }

  if (status.permission !== 'granted') {
    return 'noPermission';
  }

  return status.appEnabled && status.cycleEnabled ? 'ok' : 'switchedOff';
}

export const isDeliveryBlocked = (state: CycleDeliveryState): boolean =>
  state === 'noPermission' || state === 'switchedOff';

/**
 * Which sentence heads the reminder settings. Delivery problems come first — a planned reminder
 * that cannot arrive is not "next" — then a pause, then the next planned reminder.
 */
export type ReminderStatusKind =
  Exclude<CycleDeliveryState, 'unknown' | 'ok'> | 'paused' | 'next' | 'none';

export function reminderStatusKind({
  delivery,
  paused,
  hasUpcoming,
}: {
  delivery: CycleDeliveryState;
  paused: boolean;
  hasUpcoming: boolean;
}): ReminderStatusKind {
  if (delivery === 'web' || isDeliveryBlocked(delivery)) {
    return delivery as Exclude<CycleDeliveryState, 'unknown' | 'ok'>;
  }

  if (paused) {
    return 'paused';
  }

  return hasUpcoming ? 'next' : 'none';
}

/**
 * The notification texts the settings preview shows: one per enabled reminder (the period heads-up
 * as an example when none is on), each distinct text once — in the private style every reminder
 * reads the same. Date ranges come from the current prediction, or a plausible sample without one.
 */
export function cycleReminderPreviews({
  enabledKinds,
  timeline,
  now,
  style,
  t,
  locale,
}: {
  enabledKinds: readonly CycleReminderKind[];
  timeline: Pick<CycleTimeline, 'prediction' | 'fertileEstimate'> | null | undefined;
  now: number;
  style: CycleNotificationStyle;
  t: TFunction;
  locale: string;
}): { title: string; body: string }[] {
  const kinds = enabledKinds.length > 0 ? enabledKinds : (['period-start'] as const);
  const periodRange = {
    from: timeline?.prediction.earliest ?? addCalendarDays(now, 12),
    to: timeline?.prediction.latest ?? addCalendarDays(now, 15),
  };
  const fertileRange = {
    from: timeline?.fertileEstimate?.start ?? addCalendarDays(now, 10),
    to: timeline?.fertileEstimate?.end ?? addCalendarDays(now, 16),
  };
  const contents = kinds.map((kind) =>
    cycleReminderContent(
      { kind, range: kind === 'fertile-window' ? fertileRange : periodRange },
      style,
      t,
      locale
    )
  );
  return [
    ...new Map(contents.map((content) => [`${content.title}|${content.body}`, content])).values(),
  ];
}
