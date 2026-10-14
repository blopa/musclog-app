import { useCallback, useEffect, useState } from 'react';

import { SettingsService } from '@/database/services/SettingsService';
import { NotificationService } from '@/services/NotificationService';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/utils/notificationPolicy';

const DAY_MS = 24 * 60 * 60 * 1000;

export type PauseChoice = 'off' | '3' | '7';

function pauseChoiceFor(pausedUntil: number | null): PauseChoice {
  const remaining = pausedUntil === null ? 0 : pausedUntil - Date.now();
  if (remaining <= 0) {
    return 'off';
  }

  return remaining > 4 * DAY_MS ? '7' : '3';
}

/**
 * Reads the notification preferences blob and applies edits optimistically. Each edit is merged into
 * the stored value by the service (never a render snapshot), so two quick taps cannot clobber each
 * other. Re-planning the offline schedule is the caller's call (the settings modal does it on close).
 */
export function useNotificationPreferences(visible: boolean) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [weeklyReview, setWeeklyReview] = useState(false);
  const [pauseChoice, setPauseChoice] = useState<PauseChoice>('off');

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    void Promise.all([
      SettingsService.getNotificationPreferences(),
      SettingsService.getNotificationsWeeklyReview(),
    ]).then(([loaded, review]) => {
      if (!cancelled) {
        setPrefs(loaded);
        setPauseChoice(pauseChoiceFor(loaded.pausedUntil));
        setWeeklyReview(review);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const update = useCallback(async (patch: Partial<NotificationPreferences>) => {
    setPrefs((current) => ({ ...current, ...patch }));
    const saved = await SettingsService.updateNotificationPreferences(patch);
    setPrefs(saved);
  }, []);

  const setPause = useCallback(
    async (choice: PauseChoice) => {
      setPauseChoice(choice);
      await update({ pausedUntil: choice === 'off' ? null : Date.now() + Number(choice) * DAY_MS });
    },
    [update]
  );

  const updateWeeklyReview = useCallback(async (value: boolean) => {
    setWeeklyReview(value);
    await SettingsService.setNotificationsWeeklyReview(value);
  }, []);

  /** Asks for permission the first time any nudge is switched on, as the other toggles already do. */
  const ensurePermission = useCallback(async () => {
    await NotificationService.requestPermissions();
  }, []);

  return {
    prefs,
    update,
    pauseChoice,
    setPause,
    weeklyReview,
    updateWeeklyReview,
    ensurePermission,
  };
}
