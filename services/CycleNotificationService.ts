import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { NOTIFICATION_CHANNELS } from '@/constants/notificationActions';
import type { CycleNotificationStyle } from '@/constants/settings';
import {
  CycleRepository,
  readContexts,
  readCycleConfig,
  readPeriods,
} from '@/database/repositories/CycleRepository';
import { SettingsService } from '@/database/services/SettingsService';
import i18n from '@/lang/lang';
import { getCycleBackupPreparedAt } from '@/services/cycleRecovery';
import { cancelScheduledByType } from '@/services/notificationScheduling';
import { NotificationService } from '@/services/NotificationService';
import { cycleReminderContent } from '@/utils/cycle/cycleReminderCopy';
import { planCycleReminders } from '@/utils/cycle/cycleReminders';
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
      content: { ...content, data: { type: 'menstrual-cycle', subtype: 'test' } },
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
    await cancelScheduledByType('menstrual-cycle');

    if (!isEnabled || !isNotificationsEnabled) {
      return;
    }

    const cycle = (await CycleRepository.cycles().fetch()).find((c) => c.isActive);
    if (!cycle) {
      return;
    }

    const [periods, contexts, config, showPredictions, showFertility, style, lastBackup] =
      await Promise.all([
        CycleRepository.periods(cycle.id).fetch().then(readPeriods),
        CycleRepository.contexts(cycle.id).fetch().then(readContexts),
        readCycleConfig(cycle),
        SettingsService.getCycleShowPredictions(),
        SettingsService.getCycleShowFertility(),
        SettingsService.getCycleNotificationStyle(),
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

    for (const reminder of planCycleReminders(timeline, nowMs, {
      preferences: config.reminders,
      activePeriod,
      backupDays: config.backupReminderDays,
      lastBackup,
    })) {
      await Notifications.scheduleNotificationAsync({
        content: {
          ...cycleReminderContent(reminder, style, i18n.t.bind(i18n), locale),
          data: { type: 'menstrual-cycle', subtype: reminder.kind },
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
