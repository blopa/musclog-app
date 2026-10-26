import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { BLEEDING_LABEL_KEYS, SEVERITY_LABEL_KEYS } from '@/constants/cycle';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { useStartPeriodPrompt } from '@/hooks/useStartPeriodPrompt';
import {
  BLEEDING_LEVELS,
  parseQuickLog,
  patchDayLog as applyDayLogPatch,
  toggleSymptom,
} from '@/utils/cycle/dayLog';
import { cycleSymptomLabel } from '@/utils/cycle/preferences';
import type { BleedingLevel } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';

type QuickLogRowProps = {
  /** Local midnight ms of the day being logged. */
  day: number;
};

/**
 * The two-second path: tap a bleeding level or one of the pinned symptoms and it is saved,
 * with no form. Anything richer is the day sheet.
 */
export function QuickLogRow({ day }: QuickLogRowProps) {
  const { t } = useTranslation();
  const { cycleQuickLogRaw } = useSettings();
  const { dayLogs, patchDayLog, guidance, config } = useMenstrualCycle();
  const promptStartPeriod = useStartPeriodPrompt();
  const existing = dayLogs.find((log) => log.date === day);
  const pinned = config.quickLog ?? parseQuickLog(cycleQuickLogRaw);

  const save = async (update: Parameters<typeof patchDayLog>[1]) => {
    try {
      return await patchDayLog(day, update);
    } catch (error) {
      handleError(error, 'QuickLogRow.save', {
        sendToSentry: false,
        snackbarMessage: t('errors.somethingWentWrong'),
      });
      return null;
    }
  };

  const toggleBleeding = async (level: BleedingLevel) => {
    const saved = await save((current) =>
      applyDayLogPatch(current, day, { bleeding: current?.bleeding === level ? null : level })
    );
    if (saved) {
      promptStartPeriod(day, saved.bleeding);
    }
  };

  return (
    <View className="gap-3">
      <Text className="text-xs font-semibold text-text-tertiary">{t('cycle.quickLog.title')}</Text>
      {guidance.hidePeriodActions ? (
        <Text className="text-xs text-text-secondary">
          {t('cycle.personalize.unexpectedBleeding')}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {BLEEDING_LEVELS.map((level) => (
          <Chip
            key={level}
            label={t(BLEEDING_LABEL_KEYS[level])}
            selected={existing?.bleeding === level}
            onPress={() => void toggleBleeding(level)}
          />
        ))}
      </View>
      {pinned.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {pinned.map((key) => {
            const current = existing?.symptoms.find((s) => s.key === key);
            const name = cycleSymptomLabel(key, t);
            const severity = current?.severity
              ? ` · ${t(SEVERITY_LABEL_KEYS[current.severity])}`
              : '';

            return (
              <Chip
                key={key}
                label={`${name}${severity}`}
                selected={current != null}
                role="checkbox"
                onPress={() =>
                  void save((current) =>
                    applyDayLogPatch(current, day, {
                      symptoms: toggleSymptom(current?.symptoms ?? [], key),
                      noSymptoms: false,
                    })
                  )
                }
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
