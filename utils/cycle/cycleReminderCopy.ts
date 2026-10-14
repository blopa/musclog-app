import type { TFunction } from 'i18next';

import type { CycleNotificationStyle } from '@/constants/settings';

import type { CycleReminder, CycleReminderKind } from './cycleReminders';

/** Every reminder's name, for the "next reminder" line and the explainer sheet. */
export const REMINDER_LABEL_KEYS: Record<CycleReminderKind, string> = {
  'period-start': 'cycle.reminders.periodStart.label',
  'period-due': 'cycle.reminders.periodDue.label',
  'period-late': 'cycle.reminders.periodLate.label',
  'fertile-window': 'cycle.reminders.fertileWindow.label',
  pill: 'cycle.reminders.pill.label',
  'daily-log': 'cycle.reminders.dailyLog.label',
  'end-check': 'cycle.reminders.endCheck.label',
  backup: 'cycle.reminders.backup.label',
};

interface KindCopy {
  /** Detailed: says plainly what it is about. */
  detailedTitle: string;
  detailedBody: string;
  /** Detailed, when the estimate spans more than one day ("between {{from}} and {{to}}"). */
  detailedRangeBody?: string;
  /** Subtle: names the task, never periods, fertility or pills. */
  subtleBody: string;
}

/**
 * Every cycle reminder's wording, in one table. A `Record` so a new kind fails the build until its
 * three registers are written; whole keys so `check-translations` sees them. The detailed period
 * copy states a range and calls it an estimate; the "late" copy never mentions pregnancy.
 */
export const CYCLE_REMINDER_COPY: Record<CycleReminderKind, KindCopy> = {
  'period-start': {
    detailedTitle: 'cycle.notifications.periodStart.title',
    detailedBody: 'cycle.notifications.periodStart.body',
    detailedRangeBody: 'cycle.notifications.periodStart.bodyRange',
    subtleBody: 'cycle.notifications.subtle.cycle',
  },
  'period-due': {
    detailedTitle: 'cycle.notifications.periodDue.title',
    detailedBody: 'cycle.notifications.periodDue.body',
    subtleBody: 'cycle.notifications.subtle.cycle',
  },
  'period-late': {
    detailedTitle: 'cycle.notifications.periodLate.title',
    detailedBody: 'cycle.notifications.periodLate.body',
    detailedRangeBody: 'cycle.notifications.periodLate.bodyRange',
    subtleBody: 'cycle.notifications.subtle.cycle',
  },
  'fertile-window': {
    detailedTitle: 'cycle.notifications.fertileWindow.title',
    detailedBody: 'cycle.notifications.fertileWindow.body',
    detailedRangeBody: 'cycle.notifications.fertileWindow.bodyRange',
    subtleBody: 'cycle.notifications.subtle.cycle',
  },
  pill: {
    detailedTitle: 'cycle.notifications.pill.title',
    detailedBody: 'cycle.notifications.pill.body',
    subtleBody: 'cycle.notifications.subtle.routine',
  },
  'daily-log': {
    detailedTitle: 'cycle.notifications.dailyLog.title',
    detailedBody: 'cycle.notifications.dailyLog.body',
    subtleBody: 'cycle.notifications.subtle.checkIn',
  },
  'end-check': {
    detailedTitle: 'cycle.notifications.endCheck.title',
    detailedBody: 'cycle.notifications.endCheck.body',
    subtleBody: 'cycle.notifications.subtle.update',
  },
  backup: {
    detailedTitle: 'cycle.notifications.backup.title',
    detailedBody: 'cycle.notifications.backup.body',
    subtleBody: 'cycle.notifications.subtle.backup',
  },
};

/**
 * The exact title and body a reminder shows, for scheduling and for the settings preview alike,
 * so the preview can never promise wording the lock screen does not use.
 */
export function cycleReminderContent(
  reminder: Pick<CycleReminder, 'kind' | 'range'>,
  style: CycleNotificationStyle,
  t: TFunction,
  locale: string
): { title: string; body: string } {
  if (style === 'discreet') {
    return {
      title: t('notifications.types.cycleDiscreet.title'),
      body: t('notifications.types.cycleDiscreet.body'),
    };
  }

  const copy = CYCLE_REMINDER_COPY[reminder.kind];
  if (style === 'subtle') {
    return { title: t('notifications.types.cycleDiscreet.title'), body: t(copy.subtleBody) };
  }

  const format = (ms: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(
      ms
    );
  const range = reminder.range;
  const sameDay = range != null && format(range.from) === format(range.to);

  const bodyKey =
    range && !sameDay && copy.detailedRangeBody ? copy.detailedRangeBody : copy.detailedBody;

  return {
    title: t(copy.detailedTitle),
    body: t(bodyKey, {
      from: range ? format(range.from) : '',
      to: range ? format(range.to) : '',
    }),
  };
}
