import {
  Activity,
  Apple,
  BarChart3,
  Bell,
  BellRing,
  Calendar,
  Clock,
  Dumbbell,
  Flag,
  MoonStar,
  Repeat,
  Target,
  Timer,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { type PauseChoice, useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useTheme } from '@/hooks/useTheme';
import { refreshAllNotifications } from '@/services/notificationRefresh';
import { NotificationService } from '@/services/NotificationService';
import {
  ACCOUNTABILITY_STYLES,
  type AccountabilityStyle,
  ACTIVE_WORKOUT_UPDATE_SECONDS,
  type ActiveWorkoutUpdateSeconds,
  formatClockTime,
  LOCK_SCREEN_DETAILS,
  type LockScreenDetail,
  parseClockTime,
  REMINDER_LEAD_MINUTES,
} from '@/utils/notificationPolicy';

import { FullScreenModal } from './FullScreenModal';
import { TimePickerInput } from './TimePickerInput';
import { TimePickerModal } from './TimePickerModal';

function clockToDate(value: string): Date {
  const parsed = parseClockTime(value) ?? { hours: 0, minutes: 0 };
  const date = new Date();
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date;
}

type NotificationsSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function NotificationsSettingsModal({ visible, onClose }: NotificationsSettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const {
    notifications,
    notificationsWorkoutReminders,
    notificationsActiveWorkout,
    notificationsNutritionOverview,
    notificationsMenstrualCycle,
    notificationsRestTimer,
    notificationsWorkoutDuration,
    handleNotificationsChange,
    handleNotificationsWorkoutRemindersChange,
    handleNotificationsActiveWorkoutChange,
    handleNotificationsNutritionOverviewChange,
    handleNotificationsMenstrualCycleChange,
    handleNotificationsRestTimerChange,
    handleNotificationsWorkoutDurationChange,
    flushAllPendingChanges,
  } = useDebouncedSettings(500);

  const { prefs, update, pauseChoice, setPause, weeklyReview, updateWeeklyReview } =
    useNotificationPreferences(visible);
  const [timePicker, setTimePicker] = useState<'start' | 'end' | null>(null);
  const [delivery, setDelivery] = useState<{ permission: string; pending: number } | null>(null);

  const refreshDelivery = useCallback(() => {
    void NotificationService.getDeliveryStatus().then(setDelivery);
  }, []);

  useEffect(() => {
    if (visible) {
      refreshDelivery();
    }
  }, [visible, refreshDelivery]);

  // Helper function to ensure permissions are granted before enabling a notification setting
  const ensurePermissionsAndEnable = async (value: boolean, handler: (value: boolean) => void) => {
    handler(value);
    if (value) {
      await NotificationService.requestPermissions();
    }
  };

  useEffect(() => {
    if (!visible) {
      flushAllPendingChanges();
      // Reschedule notifications when settings might have changed
      void refreshAllNotifications().catch(() => undefined);
    }
  }, [visible, flushAllPendingChanges]);

  const icon = (Icon: typeof Bell, tint: string, background: string) => (
    <View
      className="h-10 w-10 items-center justify-center rounded-lg"
      style={{ backgroundColor: background }}
    >
      <Icon size={theme.iconSize.xl} color={tint} />
    </View>
  );
  const warn = [theme.colors.status.warning, theme.colors.status.warning10] as const;
  const info = [theme.colors.status.info, theme.colors.status.info20] as const;
  const good = [theme.colors.status.success, theme.colors.status.success20] as const;

  const withPermission = (action: (value: boolean) => void) => (value: boolean) => {
    action(value);
    if (value) {
      void NotificationService.requestPermissions().then(refreshDelivery);
    }
  };

  const sessionItems = [
    {
      key: 'restTimer',
      label: t('settings.notificationsSettings.restTimer'),
      subtitle: t('settings.notificationsSettings.restTimerSubtitle'),
      icon: icon(Timer, ...warn),
      value: notificationsRestTimer,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsRestTimerChange),
    },
    {
      key: 'restTimerRepeat',
      label: t('settings.notificationsSettings.restTimerRepeat'),
      subtitle: t('settings.notificationsSettings.restTimerRepeatSubtitle'),
      icon: icon(Repeat, ...warn),
      value: prefs.restTimerRepeat,
      onValueChange: (value: boolean) => void update({ restTimerRepeat: value }),
    },
    {
      key: 'activeWorkout',
      label: t('settings.notificationsSettings.activeWorkout'),
      subtitle: t('settings.notificationsSettings.activeWorkoutSubtitle'),
      icon: icon(Activity, ...warn),
      value: notificationsActiveWorkout,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsActiveWorkoutChange),
    },
    {
      key: 'unfinishedWorkout',
      label: t('settings.notificationsSettings.unfinishedWorkout'),
      subtitle: t('settings.notificationsSettings.unfinishedWorkoutSubtitle'),
      icon: icon(Flag, ...info),
      value: prefs.unfinishedWorkout,
      onValueChange: withPermission((value) => void update({ unfinishedWorkout: value })),
    },
    {
      key: 'workoutDuration',
      label: t('settings.notificationsSettings.workoutDuration'),
      subtitle: t('settings.notificationsSettings.workoutDurationSubtitle'),
      icon: icon(Clock, ...info),
      value: notificationsWorkoutDuration,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsWorkoutDurationChange),
    },
  ];

  const planItems = [
    {
      key: 'workoutReminders',
      label: t('settings.notificationsSettings.workoutReminders'),
      subtitle: t('settings.notificationsSettings.workoutRemindersSubtitle'),
      icon: icon(Dumbbell, ...info),
      value: notificationsWorkoutReminders,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsWorkoutRemindersChange),
    },
    {
      key: 'goalAtRisk',
      label: t('settings.notificationsSettings.goalAtRisk'),
      subtitle: t('settings.notificationsSettings.goalAtRiskSubtitle'),
      icon: icon(Target, ...info),
      value: prefs.goalAtRisk,
      onValueChange: withPermission((value) => void update({ goalAtRisk: value })),
    },
  ];

  const reportItems = [
    {
      key: 'weeklyReview',
      label: t('settings.notificationsSettings.weeklyReview'),
      subtitle: t('settings.notificationsSettings.weeklyReviewSubtitle'),
      icon: icon(BarChart3, ...good),
      value: weeklyReview,
      onValueChange: withPermission((value) => void updateWeeklyReview(value)),
    },
    {
      key: 'nutritionOverview',
      label: t('settings.notificationsSettings.nutritionOverview'),
      subtitle: t('settings.notificationsSettings.nutritionOverviewSubtitle'),
      icon: icon(Apple, ...good),
      value: notificationsNutritionOverview,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsNutritionOverviewChange),
    },
    {
      key: 'menstrualCycle',
      label: t('settings.notificationsSettings.menstrualCycle'),
      subtitle: t('settings.notificationsSettings.menstrualCycleSubtitle'),
      icon: icon(Calendar, theme.colors.status.purple, theme.colors.status.purple20),
      value: notificationsMenstrualCycle,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsMenstrualCycleChange),
    },
  ];

  const quietItems = [
    {
      key: 'quietHours',
      label: t('settings.notificationsSettings.quietHours'),
      subtitle: t('settings.notificationsSettings.quietHoursSubtitle'),
      icon: icon(MoonStar, theme.colors.status.purple, theme.colors.status.purple20),
      value: prefs.quietHoursEnabled,
      onValueChange: (value: boolean) => void update({ quietHoursEnabled: value }),
    },
  ];

  const sectionTitle = (title: string, hint?: string) => (
    <View className="gap-1 px-8">
      <Text
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color: theme.colors.text.secondary }}
      >
        {title}
      </Text>
      {hint ? (
        <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );

  const mainItem = [
    {
      key: 'notifications',
      label: t('settings.notificationsSettings.mainToggle'),
      subtitle: t('settings.notificationsSettings.mainToggleSubtitle'),
      icon: (
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.colors.accent.primary20 }}
        >
          <Bell size={theme.iconSize.xl} color={theme.colors.accent.primary} />
        </View>
      ),
      value: notifications,
      onValueChange: async (value: boolean) => {
        handleNotificationsChange(value);
        if (value) {
          await NotificationService.requestPermissions();
        }
      },
    },
  ];

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('settings.notificationsSettings.title')}
    >
      <View className="gap-8 py-6">
        <View className="px-4">
          <ToggleInput items={mainItem} />
        </View>
        {notifications ? (
          <>
            <View className="gap-4">
              {sectionTitle(t('settings.notificationsSettings.sections.session'))}
              <View className="px-4">
                <ToggleInput items={sessionItems} />
              </View>
              {notificationsActiveWorkout ? (
                <View className="gap-2 px-4">
                  <Text className="px-4 text-sm" style={{ color: theme.colors.text.secondary }}>
                    {t('settings.notificationsSettings.updateInterval')}
                  </Text>
                  <SegmentedControl
                    variant="pill"
                    fullWidth
                    value={String(prefs.activeWorkoutUpdateSeconds)}
                    onValueChange={(value) =>
                      void update({
                        activeWorkoutUpdateSeconds: Number(value) as ActiveWorkoutUpdateSeconds,
                      })
                    }
                    options={ACTIVE_WORKOUT_UPDATE_SECONDS.map((seconds) => ({
                      value: String(seconds),
                      label: t('settings.notificationsSettings.updateIntervalOption', { seconds }),
                    }))}
                  />
                </View>
              ) : null}
              <View className="gap-2 px-4">
                <Text className="px-4 text-sm" style={{ color: theme.colors.text.secondary }}>
                  {t('settings.notificationsSettings.lockScreen')}
                </Text>
                <SegmentedControl
                  variant="pill"
                  fullWidth
                  value={prefs.lockScreenDetail}
                  onValueChange={(value) =>
                    void update({ lockScreenDetail: value as LockScreenDetail })
                  }
                  options={LOCK_SCREEN_DETAILS.map((value) => ({
                    value,
                    label: t(`settings.notificationsSettings.lockScreenOptions.${value}`),
                  }))}
                />
              </View>
            </View>

            <View className="gap-4">
              {sectionTitle(t('settings.notificationsSettings.sections.plan'))}
              <View className="gap-2 px-4">
                <SegmentedControl
                  variant="pill"
                  fullWidth
                  value={prefs.accountability}
                  onValueChange={(value) =>
                    void update({ accountability: value as AccountabilityStyle })
                  }
                  options={ACCOUNTABILITY_STYLES.map((value) => ({
                    value,
                    label: t(`settings.notificationsSettings.accountability.${value}`),
                  }))}
                />
                <Text className="px-4 text-xs" style={{ color: theme.colors.text.secondary }}>
                  {t(`settings.notificationsSettings.accountabilityHints.${prefs.accountability}`)}
                </Text>
              </View>
              <View className="px-4">
                <ToggleInput items={planItems} />
              </View>
              {notificationsWorkoutReminders && prefs.accountability === 'structured' ? (
                <View className="gap-2 px-4">
                  <Text className="px-4 text-sm" style={{ color: theme.colors.text.secondary }}>
                    {t('settings.notificationsSettings.reminderLead')}
                  </Text>
                  <SegmentedControl
                    variant="pill"
                    fullWidth
                    value={String(prefs.reminderLeadMinutes)}
                    onValueChange={(value) =>
                      void update({
                        reminderLeadMinutes: Number(
                          value
                        ) as (typeof REMINDER_LEAD_MINUTES)[number],
                      })
                    }
                    options={REMINDER_LEAD_MINUTES.map((minutes) => ({
                      value: String(minutes),
                      label:
                        minutes === 0
                          ? t('settings.notificationsSettings.leadOnTime')
                          : t('settings.notificationsSettings.leadMinutes', { minutes }),
                    }))}
                  />
                </View>
              ) : null}
            </View>

            <View className="gap-4">
              {sectionTitle(t('settings.notificationsSettings.sections.reports'))}
              <View className="px-4">
                <ToggleInput items={reportItems} />
              </View>
            </View>

            <View className="gap-4">
              {sectionTitle(
                t('settings.notificationsSettings.sections.quiet'),
                t('settings.notificationsSettings.quietExempt')
              )}
              <View className="px-4">
                <ToggleInput items={quietItems} />
              </View>
              {prefs.quietHoursEnabled ? (
                <View className="gap-3 px-4">
                  <TimePickerInput
                    label={t('settings.notificationsSettings.quietFrom')}
                    selectedTime={clockToDate(prefs.quietStart)}
                    onPress={() => setTimePicker('start')}
                  />
                  <TimePickerInput
                    label={t('settings.notificationsSettings.quietUntil')}
                    selectedTime={clockToDate(prefs.quietEnd)}
                    onPress={() => setTimePicker('end')}
                  />
                </View>
              ) : null}
              <View className="gap-2 px-4">
                <Text className="px-4 text-sm" style={{ color: theme.colors.text.secondary }}>
                  {t('settings.notificationsSettings.pause')}
                </Text>
                <SegmentedControl
                  variant="pill"
                  fullWidth
                  value={pauseChoice}
                  onValueChange={(value) => void setPause(value as PauseChoice)}
                  options={[
                    { value: 'off', label: t('settings.notificationsSettings.pauseOptions.off') },
                    { value: '3', label: t('settings.notificationsSettings.pauseOptions.days3') },
                    { value: '7', label: t('settings.notificationsSettings.pauseOptions.week') },
                  ]}
                />
              </View>
            </View>

            <View className="gap-4">
              {sectionTitle(
                t('settings.notificationsSettings.sections.delivery'),
                delivery
                  ? t('settings.notificationsSettings.deliveryStatus', {
                      permission: t(
                        `settings.notificationsSettings.permission.${delivery.permission}`
                      ),
                      pending: delivery.pending,
                    })
                  : undefined
              )}
              <View className="gap-3 px-4">
                <Button
                  label={t('settings.notificationsSettings.testAlert')}
                  variant="secondary"
                  width="full"
                  icon={BellRing}
                  onPress={() => void NotificationService.testRestTimerNotification(5)}
                />
                <Button
                  label={t('settings.notificationsSettings.openSystemSettings')}
                  variant="secondary"
                  width="full"
                  onPress={() => void Linking.openSettings()}
                />
              </View>
            </View>

            <TimePickerModal
              visible={timePicker !== null}
              onClose={() => setTimePicker(null)}
              selectedTime={clockToDate(timePicker === 'end' ? prefs.quietEnd : prefs.quietStart)}
              title={t('timePicker.selectTime')}
              onTimeSelect={(time) => {
                void update(
                  timePicker === 'end'
                    ? { quietEnd: formatClockTime(time) }
                    : { quietStart: formatClockTime(time) }
                );
                setTimePicker(null);
              }}
            />
          </>
        ) : null}
      </View>
    </FullScreenModal>
  );
}
