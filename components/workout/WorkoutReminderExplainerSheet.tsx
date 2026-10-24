import { Q } from '@nozbe/watermelondb';
import { Info } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { NotificationsSettingsModal } from '@/components/modals/NotificationsSettingsModal';
import { Button } from '@/components/theme/Button';
import { database } from '@/database';
import type WorkoutTemplate from '@/database/models/WorkoutTemplate';
import { SettingsService } from '@/database/services/SettingsService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { refreshAllNotifications } from '@/services/notificationRefresh';
import { showSnackbar } from '@/utils/snackbarService';
import {
  weekdayReferenceDate,
  type WorkoutReminderContext,
} from '@/utils/workoutReminderExplainer';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAUSE_DAYS = 7;

type WorkoutReminderExplainerSheetProps = {
  /** The tapped reminder's context; null keeps the sheet closed. */
  reminder: (Partial<WorkoutReminderContext> & { templateId: string }) | null;
  onClose: () => void;
};

/**
 * "Why did I get this?", opened by tapping a workout reminder: which workout and weekday it is
 * for, where that day comes from (a plan or the workout's own schedule), when it fires relative to
 * the planned time, and the three ways out — pause every reminder for a week, turn workout
 * reminders off, or open the settings that hold the lead time. A reminder that cannot explain
 * itself is one people switch off wholesale; this makes the narrower options one tap away.
 */
export function WorkoutReminderExplainerSheet({
  reminder,
  onClose,
}: WorkoutReminderExplainerSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { locale } = useFormatAppNumber();
  const [workoutName, setWorkoutName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Rendered inside the sheet, not beside it: a second modal as a sibling is dropped by iOS.
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const templateId = reminder?.templateId ?? null;

  useEffect(() => {
    if (!templateId) {
      return;
    }

    let cancelled = false;
    void database
      .get<WorkoutTemplate>('workout_templates')
      .query(Q.where('id', templateId))
      .fetch()
      .then(([template]) => {
        if (!cancelled) {
          setWorkoutName(template?.name ?? null);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  // Writes the choice, then re-plans so the next reminder reflects it before the sheet closes.
  const apply = async (change: () => Promise<unknown>, confirmation: string) => {
    if (busy) {
      return;
    }

    setBusy(true);
    try {
      await change();
      await refreshAllNotifications().catch(() => undefined);
      showSnackbar('success', confirmation);
      onClose();
    } catch {
      showSnackbar('error', t('workoutReminder.why.failed'));
    } finally {
      setBusy(false);
    }
  };

  const workout = workoutName ?? t('workoutReminder.why.thisWorkout');
  const day =
    reminder?.dayIndex != null
      ? new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(
          weekdayReferenceDate(reminder.dayIndex)
        )
      : null;
  const lead = reminder?.leadMinutes ?? 0;

  return (
    <BottomPopUp
      visible={reminder != null}
      onClose={onClose}
      title={t('workoutReminder.why.title')}
      headerIcon={<Info size={theme.iconSize.md} color={theme.colors.accent.primary} />}
    >
      {reminder ? (
        <View className="gap-3 pb-2" testID="workout-reminder-why">
          <Text className="text-sm text-text-primary">
            {day
              ? t('workoutReminder.why.setting', { workout, day })
              : t('workoutReminder.why.settingNoDay', { workout })}
          </Text>
          {reminder.fromPlan != null ? (
            <Text className="text-sm text-text-secondary">
              {t(
                reminder.fromPlan
                  ? 'workoutReminder.why.fromPlan'
                  : 'workoutReminder.why.fromSchedule'
              )}
            </Text>
          ) : null}
          {reminder.reminderTime ? (
            <Text className="text-sm text-text-secondary">
              {lead > 0
                ? t('workoutReminder.why.timingLead', {
                    minutes: lead,
                    time: reminder.reminderTime,
                  })
                : t('workoutReminder.why.timing', { time: reminder.reminderTime })}
            </Text>
          ) : null}
          <View className="gap-2 pt-2">
            <Button
              label={t('workoutReminder.why.pause', { days: PAUSE_DAYS })}
              variant="outline"
              width="full"
              disabled={busy}
              onPress={() =>
                void apply(
                  () =>
                    SettingsService.updateNotificationPreferences({
                      pausedUntil: Date.now() + PAUSE_DAYS * DAY_MS,
                    }),
                  t('workoutReminder.why.paused', { days: PAUSE_DAYS })
                )
              }
            />
            <Button
              label={t('workoutReminder.why.turnOff')}
              variant="outline"
              width="full"
              disabled={busy}
              onPress={() =>
                void apply(
                  () => SettingsService.setNotificationsWorkoutReminders(false),
                  t('workoutReminder.why.turnedOff')
                )
              }
            />
            <Button
              label={t('workoutReminder.why.settings')}
              variant="outline"
              width="full"
              onPress={() => setIsSettingsVisible(true)}
            />
          </View>
          <NotificationsSettingsModal
            visible={isSettingsVisible}
            onClose={() => setIsSettingsVisible(false)}
          />
        </View>
      ) : null}
    </BottomPopUp>
  );
}
