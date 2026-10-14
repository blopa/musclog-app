import { useTranslation } from 'react-i18next';
import { Switch, Text, View } from 'react-native';

import { NumericInput } from '@/components/theme/NumericInput';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { DEFAULT_CYCLE_REMINDERS } from '@/utils/cycle/cycleReminders';
import type { CycleReminderPreferences } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';

export function CycleReminderSettings() {
  const { t } = useTranslation();
  const { config, updateConfig } = useMenstrualCycle();
  const preferences = config.reminders ?? DEFAULT_CYCLE_REMINDERS;
  const save = (patch: Partial<CycleReminderPreferences>) => {
    void updateConfig({ reminders: patch }).catch((error) =>
      handleError(error, 'CycleReminderSettings.save', {
        sendToSentry: false,
        snackbarMessage: t('errors.somethingWentWrong'),
      })
    );
  };

  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        {(['hour', 'minute', 'leadDays'] as const).map((key) => (
          <NumericInput
            unit=""
            key={key}
            label={t(`cycle.complete.reminders.${key}`)}
            value={String(preferences[key])}
            onChangeText={(text) => {
              const value = Number(text);
              const max = { hour: 23, minute: 59, leadDays: 14 }[key];
              if (text.trim() && Number.isInteger(value) && value >= 0 && value <= max) {
                save({ [key]: value });
              }
            }}
          />
        ))}
      </View>
      {(['period', 'fertility', 'daily', 'endCheck'] as const).map((key) => (
        <View key={key} className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-sm text-text-primary">
            {t(`cycle.complete.reminders.${key}`)}
          </Text>
          <Switch
            accessibilityLabel={t(`cycle.complete.reminders.${key}`)}
            value={preferences[key]}
            onValueChange={(value) => save({ [key]: value })}
          />
        </View>
      ))}
      <NumericInput
        unit={t('common.days.label')}
        label={t('cycle.complete.backupDays')}
        value={String(config.backupReminderDays ?? 0)}
        onChangeText={(text) => {
          const value = Number(text);
          if (text.trim() && Number.isInteger(value) && value >= 0 && value <= 365) {
            void updateConfig({ backupReminderDays: value }).catch((error) =>
              handleError(error, 'CycleReminderSettings.backup', {
                sendToSentry: false,
                snackbarMessage: t('errors.somethingWentWrong'),
              })
            );
          }
        }}
      />
      <Text className="text-xs text-text-secondary">{t('cycle.complete.remindersHint')}</Text>
    </View>
  );
}
