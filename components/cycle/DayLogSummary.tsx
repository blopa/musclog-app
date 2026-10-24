import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { TextButton } from '@/components/theme/TextButton';
import {
  BLEEDING_LABEL_KEYS,
  ENERGY_LEVEL_LABEL_KEYS,
  type EnergyLevel,
  SEVERITY_LABEL_KEYS,
} from '@/constants/cycle';
import { isMoodValue, MOOD_LABEL_KEYS } from '@/constants/mood';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { cycleSymptomLabel, OBSERVATION_FIELD_LABEL_KEYS } from '@/utils/cycle/preferences';
import type { CycleDayLogDto, ObservationField } from '@/utils/cycle/types';
import { celsiusToDisplay, getTemperatureUnitLabel } from '@/utils/unitConversion';

type DayLogSummaryProps = {
  log: CycleDayLogDto | undefined;
  onEdit: () => void;
  mood?: number;
};

/** What was logged on the selected day, in words, with one way in to change it. */
export function DayLogSummary({ log, onEdit, mood }: DayLogSummaryProps) {
  const { t } = useTranslation();
  const { formatInteger, formatDecimal } = useFormatAppNumber();
  const { units } = useSettings();

  const lines: string[] = [];
  if (isMoodValue(mood)) {
    lines.push(`${t('cycle.personalize.goals.mood')}: ${t(MOOD_LABEL_KEYS[mood])}`);
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
    lines.push(
      `${t('cycle.daySheet.energy')}: ${t(ENERGY_LEVEL_LABEL_KEYS[log.energy as EnergyLevel])}`
    );
  }

  const display = (v: unknown) => {
    if (typeof v === 'boolean') {
      return t(v ? 'common.yes' : 'common.no');
    }

    return typeof v === 'number' ? formatDecimal(v, 2) : String(v);
  };

  for (const [key, value] of Object.entries(log?.observations ?? {})) {
    // Imported health values are listed in the day sheet with their source, not mixed in here.
    if (key === 'customLabels' || key === 'health') {
      continue;
    }

    if (key === 'temperatureC' && typeof value === 'number') {
      lines.push(
        `${t(OBSERVATION_FIELD_LABEL_KEYS.temperatureC)}: ${formatDecimal(
          celsiusToDisplay(value, units),
          2
        )} ${getTemperatureUnitLabel(units)}`
      );
    } else if (key === 'custom') {
      for (const [id, v] of Object.entries(value as Record<string, unknown>)) {
        lines.push(`${log?.observations?.customLabels?.[id] ?? id}: ${display(v)}`);
      }
    } else {
      lines.push(
        `${t(OBSERVATION_FIELD_LABEL_KEYS[key as ObservationField] ?? key)}: ${display(value)}`
      );
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
