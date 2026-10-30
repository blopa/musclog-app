import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';
import { NotificationService } from '@/services/NotificationService';

export const REST_ALERTS_PROMPTED_KEY = 'rest_alerts_prompted';

/**
 * Asks for notification permission at the one moment its value is obvious — right after the first
 * completed set, with a rest timer already counting — instead of in a settings screen nobody opens.
 * Asked at most once; a "not now" is remembered and the settings toggle stays the way back.
 */
export function RestAlertsPrompt({ hasCompletedSet }: { hasCompletedSet: boolean }) {
  const { t } = useTranslation();
  const { notifications, notificationsRestTimer } = useSettings();
  const [visible, setVisible] = useState(false);
  const alreadyOn = notifications && notificationsRestTimer;

  useEffect(() => {
    if (Platform.OS === 'web' || !hasCompletedSet || alreadyOn) {
      return;
    }

    let cancelled = false;
    void AsyncStorage.getItem(REST_ALERTS_PROMPTED_KEY).then(async (value) => {
      if (cancelled || value) {
        return;
      }

      // Remembered before it is shown, so killing the app mid-prompt never nags again.
      await AsyncStorage.setItem(REST_ALERTS_PROMPTED_KEY, '1');
      if (!cancelled) {
        setVisible(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hasCompletedSet, alreadyOn]);

  const enable = async () => {
    await SettingsService.setNotifications(true);
    await SettingsService.setNotificationsRestTimer(true);
    await NotificationService.requestPermissions();
  };

  return (
    <ConfirmationModal
      visible={visible}
      onClose={() => setVisible(false)}
      onConfirm={enable}
      title={t('notifications.restPrompt.title')}
      message={t('notifications.restPrompt.message')}
      confirmLabel={t('notifications.restPrompt.confirm')}
      cancelLabel={t('notifications.restPrompt.cancel')}
    />
  );
}
