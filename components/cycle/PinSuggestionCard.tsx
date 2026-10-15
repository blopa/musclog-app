import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { MAX_QUICK_LOG, parseQuickLog, suggestPin, togglePinned } from '@/utils/cycle/dayLog';
import { cycleSymptomLabel } from '@/utils/cycle/preferences';
import { handleError } from '@/utils/handleError';

/**
 * Offers to pin a symptom the person keeps logging, once, after enough evidence. The quick log
 * starts empty-handed and learns, rather than opening with a hundred-item taxonomy.
 */
export function PinSuggestionCard() {
  const { t } = useTranslation();
  const { cycleQuickLogRaw } = useSettings();
  const { dayLogs, periods, config, updateConfig } = useMenstrualCycle();
  const [legacyOffered, setOffered] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void SettingsService.get(SETTINGS.cyclePinSuggested).then((raw) => {
      if (!cancelled) {
        setOffered(raw.split(',').filter(Boolean));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const offered = config.pinSuggested ?? legacyOffered;
  if (offered == null) {
    return null;
  }

  const pinned = config.quickLog ?? parseQuickLog(cycleQuickLogRaw);
  if (pinned.length >= MAX_QUICK_LOG) {
    return null;
  }

  const key = suggestPin(
    dayLogs,
    periods.map((p) => p.startDate).sort((a, b) => a - b),
    pinned,
    offered
  );
  if (!key) {
    return null;
  }

  const name = cycleSymptomLabel(key, t).toLowerCase();

  const answer = async (pin: boolean) => {
    try {
      // Remember the offer either way, so a "no thanks" is not asked again.
      await updateConfig((current) => ({
        pinSuggested: [...new Set([...(current.pinSuggested ?? offered), key])],
        ...(pin
          ? { quickLog: togglePinned(current.quickLog ?? parseQuickLog(cycleQuickLogRaw), key) }
          : {}),
      }));
      setOffered([...offered, key]);
    } catch (error) {
      handleError(error, 'PinSuggestionCard.answer', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    }
  };

  return (
    <View className="mb-6 gap-3 rounded-2xl border-2 border-ink/5 bg-bg-overlay p-4">
      <Text className="text-sm text-text-primary">
        {t('cycle.quickLog.pinPrompt', { symptom: name })}
      </Text>
      <View className="flex-row gap-3">
        <Button
          label={t('cycle.quickLog.noThanks')}
          variant="outline"
          width="flex-1"
          onPress={() => void answer(false)}
        />
        <Button
          label={t('cycle.quickLog.pin')}
          variant="accent"
          width="flex-1"
          onPress={() => void answer(true)}
        />
      </View>
    </View>
  );
}
