import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  CYCLE_NOTIFICATION_TYPE,
  CYCLE_SNOOZE_NOTIFICATION_TYPE,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
} from '@/constants/notificationActions';
import { SETTINGS } from '@/constants/settingDefinitions';
import type { CycleNotificationStyle } from '@/constants/settings';
import { waitForDbReady } from '@/database/dbReady';
import {
  CycleRepository,
  readContexts,
  readCycleConfig,
  readPeriods,
} from '@/database/repositories/CycleRepository';
import { CycleDayLogService } from '@/database/services/CycleDayLogService';
import { SettingsService } from '@/database/services/SettingsService';
import i18n from '@/lang/lang';
import { getCycleBackupPreparedAt } from '@/services/cycleRecovery';
import { cancelScheduledByType, cancelScheduledWhere } from '@/services/notificationScheduling';
import { NotificationService } from '@/services/NotificationService';
import { localDayStartMs } from '@/utils/calendarDate';
import { cycleReminderContent } from '@/utils/cycle/cycleReminderCopy';
import {
  CYCLE_SNOOZE_MINUTES,
  isCycleReminderKind,
  isSnoozeStillValid,
  PILL_LATER_MINUTES,
  type PillAnswer,
  planCycleReminders,
} from '@/utils/cycle/cycleReminders';
import { buildCycleSnapshot } from '@/utils/cycle/cycleSnapshot';

export interface CycleDeliveryStatus {
  permission: Notifications.PermissionStatus | 'unsupported';
  appEnabled: boolean;
  cycleEnabled: boolean;
}

export class CycleNotificationService {
  private static cycleReminderQueue: Promise<void> = Promise.resolve();

  /** Serialised: every cycle write and app foreground reschedules, and two passes must not interleave. */
  static scheduleMenstrualCycleNotifications(): Promise<void> {
    const next = CycleNotificationService.cycleReminderQueue
      .catch(() => undefined)
      .then(() => CycleNotificationService.scheduleMenstrualCycleNotificationsNow());
    CycleNotificationService.cycleReminderQueue = next;
    return next;
  }

  /**
   * Everything the cycle reminder settings need to say whether a reminder can actually reach the
   * person: the OS permission, the app-wide switch and the cycle switch. Read, never requested.
   */
  static async getCycleDeliveryStatus(): Promise<CycleDeliveryStatus> {
    const [appEnabled, cycleEnabled] = await Promise.all([
      SettingsService.getNotifications(),
      SettingsService.getNotificationsMenstrualCycle(),
    ]);
    if (Platform.OS === 'web') {
      return { permission: 'unsupported', appEnabled, cycleEnabled };
    }

    const { status } = (await Notifications.getPermissionsAsync()) as {
      status: Notifications.PermissionStatus;
    };

    return { permission: status, appEnabled, cycleEnabled };
  }

  /**
   * Asked in context: only when the person turns cycle reminders on, after seeing what they will
   * look like, never at launch. Switches both settings on and reschedules on success.
   */
  static async enableCycleReminders(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    await NotificationService.configure();
    const granted = await NotificationService.requestPermissions();
    if (!granted) {
      return false;
    }

    await SettingsService.setNotifications(true);
    await SettingsService.setNotificationsMenstrualCycle(true);
    await CycleNotificationService.scheduleMenstrualCycleNotifications();
    return true;
  }

  /**
   * The "Later" and "Snooze" buttons: the same notification again after `minutes`. It is a one-shot
   * of its own type, so the reschedule that replaces ordinary reminders does not erase it — that
   * pass re-checks it instead (`pruneSnoozedReminders`).
   */
  static async snooze(content: Notifications.NotificationContent, minutes: number): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }

    const kind = content.data?.['subtype'];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title ?? '',
        body: content.body ?? '',
        categoryIdentifier: content.categoryIdentifier ?? NOTIFICATION_CATEGORIES.cycleReminder,
        data: { type: CYCLE_SNOOZE_NOTIFICATION_TYPE, subtype: kind },
        ...Platform.select({ android: { channelId: NOTIFICATION_CHANNELS.cycle } }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: minutes * 60,
      },
    });
  }

  static snoozeReminder(content: Notifications.NotificationContent): Promise<void> {
    return CycleNotificationService.snooze(content, CYCLE_SNOOZE_MINUTES);
  }

  static snoozePill(content: Notifications.NotificationContent): Promise<void> {
    return CycleNotificationService.snooze(content, PILL_LATER_MINUTES);
  }

  /**
   * Records the pill reminder's answer on today's diary page, merging into whatever is already
   * there inside the writer so a note or symptom logged earlier survives. Runs from a notification
   * button, possibly in a cold-started process, so it waits for the database first. Answering also
   * retires a pending "Later" copy: it has been answered.
   */
  static async recordPillAnswer(answer: PillAnswer): Promise<void> {
    await waitForDbReady();
    await CycleDayLogService.patch(localDayStartMs(new Date()), (existing) => ({
      date: existing?.date ?? localDayStartMs(new Date()),
      bleeding: existing?.bleeding ?? null,
      symptoms: existing?.symptoms ?? [],
      noSymptoms: existing?.noSymptoms ?? false,
      pain: existing?.pain ?? null,
      energy: existing?.energy ?? null,
      note: existing?.note ?? '',
      observations: { ...existing?.observations, pill: answer },
    }));
    await cancelScheduledWhere(
      (n) =>
        n.content.data?.type === CYCLE_SNOOZE_NOTIFICATION_TYPE &&
        n.content.data?.subtype === 'pill'
    );
  }

  /** Cancels the snoozed copies the plan would no longer produce (a pause, a context change). */
  private static async pruneSnoozedReminders(
    state: Parameters<typeof isSnoozeStillValid>[1] | null,
    scheduled: Notifications.NotificationRequest[]
  ): Promise<void> {
    await cancelScheduledWhere((n) => {
      if (n.content.data?.type !== CYCLE_SNOOZE_NOTIFICATION_TYPE) {
        return false;
      }

      const kind = n.content.data?.subtype;
      return (
        state == null ||
        typeof kind !== 'string' ||
        !isCycleReminderKind(kind) ||
        !isSnoozeStillValid(kind, state)
      );
    }, scheduled);
  }

  /** Sends, in a few seconds, exactly what a daily check-in would look like in the chosen style. */
  static async sendCycleTestNotification(style: CycleNotificationStyle): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    await NotificationService.configure();
    if (!(await NotificationService.requestPermissions())) {
      return false;
    }

    const content = cycleReminderContent(
      { kind: 'daily-log' },
      style,
      i18n.t.bind(i18n),
      i18n.resolvedLanguage ?? i18n.language
    );
    await Notifications.scheduleNotificationAsync({
      content: { ...content, data: { type: CYCLE_NOTIFICATION_TYPE, subtype: 'test' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3,
        channelId: NOTIFICATION_CHANNELS.cycle,
      },
    });
    return true;
  }

  private static async scheduleMenstrualCycleNotificationsNow() {
    if (Platform.OS === 'web') {
      return;
    }

    const [isEnabled, isNotificationsEnabled] = await Promise.all([
      SettingsService.getNotificationsMenstrualCycle(),
      SettingsService.getNotifications(),
    ]);

    // Clear existing: a context change (pregnancy, a loss, a hormonal method) or a pause takes
    // effect by not planning the incompatible reminders again.
    // One read of the scheduled list serves both cancellations: the reminders being replaced and
    // the snoozed copies that must be re-checked rather than replaced.
    const scheduled = (await Notifications.getAllScheduledNotificationsAsync()) ?? [];
    await cancelScheduledByType(CYCLE_NOTIFICATION_TYPE, scheduled);

    if (!isEnabled || !isNotificationsEnabled) {
      await CycleNotificationService.pruneSnoozedReminders(null, scheduled);
      return;
    }

    const cycle = (await CycleRepository.cycles().fetch()).find((c) => c.isActive);
    if (!cycle) {
      await CycleNotificationService.pruneSnoozedReminders(null, scheduled);
      return;
    }

    const [periods, contexts, config, showPredictions, showFertility, style, lastBackup] =
      await Promise.all([
        CycleRepository.periods(cycle.id).fetch().then(readPeriods),
        CycleRepository.contexts(cycle.id).fetch().then(readContexts),
        readCycleConfig(cycle),
        SettingsService.get(SETTINGS.cycleShowPredictions),
        SettingsService.get(SETTINGS.cycleShowFertility),
        SettingsService.get(SETTINGS.cycleNotificationStyle),
        getCycleBackupPreparedAt(),
      ]);
    const nowMs = Date.now();
    const { timeline, activePeriod } = buildCycleSnapshot({
      periods,
      contexts,
      config,
      nowMs,
      showPredictions,
      showFertility,
    });
    const locale = i18n.resolvedLanguage ?? i18n.language;
    await CycleNotificationService.pruneSnoozedReminders(
      { timeline, preferences: config.reminders, backupDays: config.backupReminderDays, nowMs },
      scheduled
    );

    for (const reminder of planCycleReminders(timeline, nowMs, {
      preferences: config.reminders,
      activePeriod,
      backupDays: config.backupReminderDays,
      lastBackup,
    })) {
      await Notifications.scheduleNotificationAsync({
        content: {
          ...cycleReminderContent(reminder, style, i18n.t.bind(i18n), locale),
          categoryIdentifier:
            reminder.kind === 'pill'
              ? NOTIFICATION_CATEGORIES.cyclePill
              : NOTIFICATION_CATEGORIES.cycleReminder,
          data: { type: CYCLE_NOTIFICATION_TYPE, subtype: reminder.kind },
        },
        trigger: reminder.repeatsDaily
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: reminder.date.getHours(),
              minute: reminder.date.getMinutes(),
              channelId: NOTIFICATION_CHANNELS.cycle,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminder.date,
              channelId: NOTIFICATION_CHANNELS.cycle,
            },
      });
    }
  }
}
