import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { TextButton } from '@/components/theme/TextButton';
import { BLEEDING_LABEL_KEYS, SEVERITY_LABEL_KEYS } from '@/constants/cycle';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { cycleSymptomLabel } from '@/utils/cycle/preferences';
import type { CycleDayLogDto } from '@/utils/cycle/types';

type DayLogSummaryProps = {
  log: CycleDayLogDto | undefined;
  onEdit: () => void;
  mood?: number;
};

/** What was logged on the selected day, in words, with one way in to change it. */
export function DayLogSummary({ log, onEdit, mood }: DayLogSummaryProps) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  const lines: string[] = [];
  if (mood != null) {
    lines.push(`${t('cycle.personalize.goals.mood')}: ${t(`bodyMetrics.addEntry.moods.${mood}`)}`);
  }

  if (log?.bleeding) {
    lines.push(`${t('cycle.flowIntensity')}: ${t(BLEEDING_LABEL_KEYS[log.bleeding])}`);
  }

  if (log && log.symptoms.length > 0) {
    const names = log.symptoms.map((s) => {
      const name = cycleSymptomLabel(s.key, t);

      return s.severity ? `${name} (${t(SEVERITY_LABEL_KEYS[s.severity])})` : name;
    });
    lines.push(`${t('cycle.symptomsTitle')}: ${names.join(', ')}`);
  } else if (log?.noSymptoms) {
    lines.push(t('cycle.daySheet.noSymptomsLogged'));
  }

  if (log?.pain != null) {
    lines.push(`${t('cycle.daySheet.pain')}: ${formatInteger(log.pain)}/10`);
  }

  if (log?.energy != null) {
    lines.push(`${t('cycle.daySheet.energy')}: ${t(`cycle.daySheet.energyLevel.${log.energy}`)}`);
  }

  for (const [key, value] of Object.entries(log?.observations ?? {})) {
    if (key === 'customLabels') {
      continue;
    }

    const display = (v: unknown) =>
      typeof v === 'boolean' ? t(v ? 'common.yes' : 'common.no') : String(v);
    if (key === 'custom') {
      for (const [id, v] of Object.entries(value as Record<string, unknown>)) {
        lines.push(`${log?.observations?.customLabels?.[id] ?? id}: ${display(v)}`);
      }
    } else {
      lines.push(`${t(`cycle.personalize.fields.${key}`)}: ${display(value)}`);
    }
  }

  if (log?.note) {
    lines.push(log.note);
  }

  return (
    <View className="rounded-2xl border-2 border-ink/5 bg-bg-card p-4">
      {lines.length === 0 ? (
        <Text className="text-sm text-text-secondary">{t('cycle.daySheet.nothingLogged')}</Text>
      ) : (
        <View className="gap-1">
          {lines.map((line) => (
            <Text key={line} className="text-sm text-text-primary">
              {line}
            </Text>
          ))}
        </View>
      )}
      <TextButton
        label={lines.length === 0 ? t('cycle.daySheet.addDetails') : t('cycle.daySheet.edit')}
        onPress={onEdit}
      />
    </View>
  );
}
