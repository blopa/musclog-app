import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { BLEEDING_LABEL_KEYS, SEVERITY_LABEL_KEYS, SYMPTOM_LABEL_KEYS } from '@/constants/cycle';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { useStartPeriodPrompt } from '@/hooks/useStartPeriodPrompt';
import { BLEEDING_LEVELS, parseQuickLog, patchDayLog, stepSymptom } from '@/utils/cycle/dayLog';
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
  const { dayLogs, saveDayLog, guidance } = useMenstrualCycle();
  const promptStartPeriod = useStartPeriodPrompt();
  const existing = dayLogs.find((log) => log.date === day);
  const pinned = parseQuickLog(cycleQuickLogRaw);

  const save = async (patch: Parameters<typeof patchDayLog>[2]) => {
    try {
      await saveDayLog(patchDayLog(existing, day, patch));
    } catch (error) {
      handleError(error, 'QuickLogRow.save', { snackbarMessage: t('errors.somethingWentWrong') });
    }
  };

  const toggleBleeding = async (level: BleedingLevel) => {
    const next = existing?.bleeding === level ? null : level;
    await save({ bleeding: next });
    promptStartPeriod(day, next);
  };

  return (
    <View className="gap-3">
      <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
        {t('cycle.quickLog.title')}
      </Text>
      {guidance.hidePeriodActions ? null : (
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
      )}
      {pinned.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {pinned.map((key) => {
            const current = existing?.symptoms.find((s) => s.key === key);
            const name = SYMPTOM_LABEL_KEYS[key]
              ? t(SYMPTOM_LABEL_KEYS[key])
              : key.replace(/_/g, ' ');
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
                  void save({
                    symptoms: stepSymptom(existing?.symptoms ?? [], key),
                    noSymptoms: false,
                  })
                }
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
