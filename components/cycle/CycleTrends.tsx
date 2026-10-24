import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { CycleTrendChart } from '@/components/cycle/CycleTrendChart';
import { Chip } from '@/components/theme/Chip';
import { TextButton } from '@/components/theme/TextButton';
import { TextInput } from '@/components/theme/TextInput';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { addCalendarDays } from '@/utils/cycle/dates';
import {
  searchCycleLogs,
  summarizeWindow,
  type TrendMetric,
  type TrendPoint,
  trendPoints,
} from '@/utils/cycle/historyAnalysis';
import { cycleSymptomLabel } from '@/utils/cycle/preferences';

const METRICS: TrendMetric[] = [
  'pain',
  'energy',
  'mood',
  'sleepHours',
  'temperatureC',
  'importedTemperatureC',
  'impact',
  'bleeding',
];
export function CycleTrends({ onSelectDay }: { onSelectDay: (day: number) => void }) {
  const { t, i18n } = useTranslation();
  const { dayLogs, config, periods, history, contexts, today, moods } = useMenstrualCycle();
  const { formatInteger, formatDecimal } = useFormatAppNumber();
  const [query, setQuery] = useState('');
  const [metric, setMetric] = useState<TrendMetric>('pain');
  const [days, setDays] = useState(90);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const date = (ms: number) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(ms);
  const from = addCalendarDays(today, -days);
  const filtered = useMemo(
    () => dayLogs.filter((log) => log.date >= from && log.date <= today),
    [dayLogs, from, today]
  );
  const points = trendPoints(
    filtered,
    moods.filter((m) => m.date >= from && m.date <= today),
    metric
  );
  const labels = Object.fromEntries(
    dayLogs.flatMap((d) => d.symptoms.map((s) => [s.key, cycleSymptomLabel(s.key, t)]))
  );
  const found = searchCycleLogs(filtered, query, labels);
  const summary = summarizeWindow(filtered, from, today);
  const cycleLengths = history
    .filter((h) => h.start >= from && h.lengthDays != null)
    .map((h) => h.lengthDays!);
  const latest = [...periods]
    .filter((p) => p.startDate <= today)
    .sort((a, b) => b.startDate - a.startDate)[0];
  const recap = latest ? summarizeWindow(dayLogs, latest.startDate, today) : null;
  const options = [
    ...METRICS,
    ...(config.customFields ?? [])
      .filter((f) => f.kind === 'number' || f.kind === 'rating')
      .map((f) => `custom:${f.id}` as TrendMetric),
  ];
  const label = (key: TrendMetric) =>
    key.startsWith('custom:')
      ? (config.customFields?.find((f) => `custom:${f.id}` === key)?.label ?? key)
      : t(`cycle.complete.metrics.${key}`);
  const pointLabel = (point: TrendPoint) => {
    if (!point.source) {
      return formatDecimal(point.value, 1);
    }

    return t('cycle.complete.importedValue', {
      source: point.source === 'healthkit' ? 'Apple Health' : 'Health Connect',
      value: formatDecimal(point.value, 2) + ' °C',
    });
  };

  return (
    <View className="gap-4 rounded-2xl bg-bg-overlay p-4">
      <Text className="text-lg font-bold text-text-primary">{t('cycle.complete.trends')}</Text>
      <Text className="text-sm text-text-secondary">{t('cycle.complete.trendsHint')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {[30, 90, 365].map((n) => (
          <Chip
            key={n}
            selected={days === n}
            label={t('cycle.complete.lastDays', { days: formatInteger(n) })}
            onPress={() => setDays(n)}
          />
        ))}
      </View>
      <Text className="text-sm text-text-primary">
        {t('cycle.complete.summary', {
          logged: formatInteger(summary.loggedDays),
          heavy: formatInteger(summary.heavyDays),
          spotting: formatInteger(summary.spottingDays),
          impact: formatInteger(summary.impactDays),
        })}
      </Text>
      {cycleLengths.length > 1 ? (
        <Text className="text-sm text-text-secondary">
          {t('cycle.complete.variabilitySummary', {
            count: formatInteger(cycleLengths.length),
            low: formatInteger(Math.min(...cycleLengths)),
            high: formatInteger(Math.max(...cycleLengths)),
          })}
        </Text>
      ) : null}
      {recap ? (
        <Text className="text-sm text-text-secondary">
          {t('cycle.complete.recap', {
            date: date(latest!.startDate),
            logged: formatInteger(recap.loggedDays),
            heavy: formatInteger(recap.heavyDays),
            impact: formatInteger(recap.impactDays),
          })}
        </Text>
      ) : null}
      {summary.symptoms.slice(0, 8).map((s) => (
        <Text key={s.key} className="text-sm text-text-primary">
          {t('cycle.complete.symptomSummary', {
            symptom: cycleSymptomLabel(s.key, t),
            days: formatInteger(s.days),
            severe: formatInteger(s.severe),
          })}
        </Text>
      ))}
      <View className="flex-row flex-wrap gap-2">
        {options.map((key) => (
          <Chip
            key={key}
            label={label(key)}
            selected={key === metric}
            onPress={() => setMetric(key)}
          />
        ))}
      </View>
      <CycleTrendChart points={points} label={label(metric)} />
      <Text className="text-xs text-text-secondary">{t('cycle.complete.loggedOnly')}</Text>
      {points.length ? (
        points.slice(-30).map((point, index) => (
          <View key={`${point.date}:${index}`} className="flex-row items-center justify-between">
            <TextButton label={date(point.date)} onPress={() => onSelectDay(point.date)} />
            <Text className="text-sm text-text-primary">{pointLabel(point)}</Text>
          </View>
        ))
      ) : (
        <Text className="text-sm text-text-secondary">{t('cycle.complete.noObservations')}</Text>
      )}
      {contexts
        .filter((c) => c.effectiveFrom >= from && c.effectiveFrom <= today)
        .map((c) => (
          <Text key={c.id} className="text-xs text-text-secondary">
            {t('cycle.complete.contextChanged', { date: date(c.effectiveFrom) })}
          </Text>
        ))}
      <TextInput label={t('cycle.complete.search')} value={query} onChangeText={setQuery} />
      <Text className="text-xs text-text-secondary">{t('cycle.complete.searchHint')}</Text>
      {found.slice(0, 50).map((log) => (
        <TextButton
          key={log.id}
          label={`${date(log.date)}${log.note ? ` · ${log.note.slice(0, 80)}` : ''}`}
          onPress={() => onSelectDay(log.date)}
        />
      ))}
      {!found.length ? (
        <Text className="text-sm text-text-secondary">{t('cycle.complete.noObservations')}</Text>
      ) : null}
    </View>
  );
}
