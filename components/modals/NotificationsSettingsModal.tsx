import { Activity, Apple, Bell, Calendar, Clock, Dumbbell, Timer } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ToggleInput } from '@/components/theme/ToggleInput';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { useTheme } from '@/hooks/useTheme';
import { NotificationService } from '@/services/NotificationService';

import { FullScreenModal } from './FullScreenModal';

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
      NotificationService.scheduleWorkoutReminders();
      NotificationService.scheduleNutritionOverview();
      NotificationService.scheduleMenstrualCycleNotifications();
    }
  }, [visible, flushAllPendingChanges]);

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

  const subItems = [
    {
      key: 'workoutReminders',
      label: t('settings.notificationsSettings.workoutReminders'),
      subtitle: t('settings.notificationsSettings.workoutRemindersSubtitle'),
      icon: (
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.colors.status.info20 }}
        >
          <Dumbbell size={theme.iconSize.xl} color={theme.colors.status.info} />
        </View>
      ),
      value: notificationsWorkoutReminders,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsWorkoutRemindersChange),
    },
    {
      key: 'activeWorkout',
      label: t('settings.notificationsSettings.activeWorkout'),
      subtitle: t('settings.notificationsSettings.activeWorkoutSubtitle'),
      icon: (
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.colors.status.warning10 }}
        >
          <Activity size={theme.iconSize.xl} color={theme.colors.status.warning} />
        </View>
      ),
      value: notificationsActiveWorkout,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsActiveWorkoutChange),
    },
    {
      key: 'restTimer',
      label: t('settings.notificationsSettings.restTimer'),
      subtitle: t('settings.notificationsSettings.restTimerSubtitle'),
      icon: (
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.colors.status.warning10 }}
        >
          <Timer size={theme.iconSize.xl} color={theme.colors.status.warning} />
        </View>
      ),
      value: notificationsRestTimer,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsRestTimerChange),
    },
    {
      key: 'workoutDuration',
      label: t('settings.notificationsSettings.workoutDuration'),
      subtitle: t('settings.notificationsSettings.workoutDurationSubtitle'),
      icon: (
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.colors.status.info20 }}
        >
          <Clock size={theme.iconSize.xl} color={theme.colors.status.info} />
        </View>
      ),
      value: notificationsWorkoutDuration,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsWorkoutDurationChange),
    },
    {
      key: 'nutritionOverview',
      label: t('settings.notificationsSettings.nutritionOverview'),
      subtitle: t('settings.notificationsSettings.nutritionOverviewSubtitle'),
      icon: (
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.colors.status.success20 }}
        >
          <Apple size={theme.iconSize.xl} color={theme.colors.status.success} />
        </View>
      ),
      value: notificationsNutritionOverview,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsNutritionOverviewChange),
    },
    {
      key: 'menstrualCycle',
      label: t('settings.notificationsSettings.menstrualCycle'),
      subtitle: t('settings.notificationsSettings.menstrualCycleSubtitle'),
      icon: (
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.colors.status.purple20 }}
        >
          <Calendar size={theme.iconSize.xl} color={theme.colors.status.purple} />
        </View>
      ),
      value: notificationsMenstrualCycle,
      onValueChange: (value: boolean) =>
        ensurePermissionsAndEnable(value, handleNotificationsMenstrualCycleChange),
    },
  ];

  return (
    <FullScreenModal
      debugKey="NotificationsSettingsModal"
      visible={visible}
      onClose={onClose}
      title={t('settings.notificationsSettings.title')}
    >
      <View className="gap-8 py-6">
        <View className="px-4">
          <ToggleInput items={mainItem} />
        </View>
        {notifications ? (
          <View className="gap-4">
            <Text
              className="px-8 text-xs font-bold uppercase tracking-wider"
              style={{ color: theme.colors.text.secondary }}
            >
              {t('settings.notificationsSettings.title')}
            </Text>
            <View className="px-4">
              <ToggleInput items={subItems} />
            </View>
          </View>
        ) : null}
      </View>
    </FullScreenModal>
  );
}
