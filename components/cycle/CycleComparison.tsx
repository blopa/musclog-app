import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { TextInput } from '@/components/theme/TextInput';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useTheme } from '@/hooks/useTheme';
import {
  buildCycleComparison,
  type ComparisonAnchor,
  type ComparisonMetric,
} from '@/utils/cycle/cycleComparison';
import { cycleSymptomLabel } from '@/utils/cycle/preferences';

export function CycleComparison({ onSelectDay }: { onSelectDay: (date: number) => void }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { periods, dayLogs, today, moods, moodsError: error } = useMenstrualCycle();
  const [metric, setMetric] = useState<ComparisonMetric>('bleeding');
  const [anchor, setAnchor] = useState<ComparisonAnchor>('start');
  const [query, setQuery] = useState('');
  const metrics = (['bleeding', 'pain', 'energy', 'mood'] as ComparisonMetric[]).concat([
    ...new Set(dayLogs.flatMap((d) => d.symptoms.map((s) => `symptom:${s.key}` as const))),
  ]);
  const label = (key: ComparisonMetric) =>
    key.startsWith('symptom:')
      ? cycleSymptomLabel(key.slice(8), t)
      : t(`cycle.comparison.metrics.${key}`);
  const rows = useMemo(
    () => buildCycleComparison(periods, dayLogs, moods, metric, anchor, today),
    [periods, dayLogs, moods, metric, anchor, today]
  );
  const date = (ms: number) =>
    new Date(ms).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language);
  let legendKey = 'cycle.comparison.numberLegend';
  if (metric === 'bleeding') {
    legendKey = 'cycle.comparison.flowLegend';
  } else if (metric.startsWith('symptom:')) {
    legendKey = 'cycle.comparison.symptomLegend';
  }

  const cellText = (value: number | null) => {
    if (value == null) {
      return '—';
    }

    if (value === -1) {
      return '●';
    }

    return String(value);
  };

  const spokenCell = (value: number | null) => {
    if (value == null) {
      return t('cycle.comparison.unlogged');
    }

    if (value === -1) {
      return t('cycle.comparison.unrated');
    }

    return String(value);
  };

  return (
    <View className="gap-4 rounded-2xl bg-bg-card p-4">
      <Text className="text-base font-bold text-text-primary">{t('cycle.comparison.title')}</Text>
      <Text className="text-sm text-text-secondary">{t('cycle.comparison.description')}</Text>
      <SegmentedControl
        value={anchor}
        onValueChange={(value) => setAnchor(value as ComparisonAnchor)}
        options={[
          { value: 'start', label: t('cycle.comparison.start') },
          { value: 'before', label: t('cycle.comparison.before') },
        ]}
      />
      <TextInput label={t('cycle.comparison.filter')} value={query} onChangeText={setQuery} />
      <View className="flex-row flex-wrap gap-2">
        {metrics
          .filter((key) => label(key).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
          .map((key) => (
            <Chip
              key={key}
              label={label(key)}
              selected={metric === key}
              onPress={() => setMetric(key)}
            />
          ))}
      </View>
      <Text className="text-sm font-bold text-text-primary">{label(metric)}</Text>
      <Text className="text-xs text-text-secondary">{t(legendKey)}</Text>
      {error ? (
        <Text className="text-sm text-text-secondary">{t('errors.somethingWentWrong')}</Text>
      ) : null}
      {rows.length === 0 ? (
        <Text className="text-sm text-text-secondary">{t('cycle.comparison.empty')}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View className="gap-4 pb-4">
            {rows.map((row) => (
              <View key={row.start} className="gap-2">
                <Text className="text-sm font-bold text-text-primary">
                  {date(row.start)}
                  {row.complete ? '' : ` · ${t('cycle.comparison.inProgress')}`}
                </Text>
                <View className="flex-row gap-1">
                  {row.cells.map((cell) => (
                    <Pressable
                      key={cell.date}
                      accessibilityRole="button"
                      accessibilityLabel={`${date(cell.date)} · ${label(metric)}: ${spokenCell(cell.value)}`}
                      onPress={() => onSelectDay(cell.date)}
                      className="min-h-12 min-w-12 items-center justify-center rounded-lg border border-border-default p-2"
                      style={{
                        backgroundColor:
                          cell.value != null && cell.value > 0
                            ? theme.colors.accent.primary20
                            : theme.colors.background.card,
                      }}
                    >
                      <Text className="text-xs text-text-secondary">{cell.day}</Text>
                      <Text className="text-sm font-bold text-text-primary">
                        {cellText(cell.value)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <Text className="text-xs text-text-secondary">{t('cycle.comparison.limitHint')}</Text>
    </View>
  );
}
