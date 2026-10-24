import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { CycleHistoryEntry, CyclePeriodDto } from '@/utils/cycle/types';

type PeriodHistoryListProps = {
  periods: CyclePeriodDto[];
  history: CycleHistoryEntry[];
  onEdit: (period: CyclePeriodDto) => void;
};

/**
 * One row per logged period, newest first: its dates, how long it lasted (with an honest chip
 * when the end is estimated or unknown), and the length of the cycle to the next one. A cycle
 * that is not used for predictions stays in the list, muted, with the reason in words.
 */
export function PeriodHistoryList({ periods, history, onEdit }: PeriodHistoryListProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const date = (ms: number) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(ms);
  const byStart = new Map(history.map((h) => [h.start, h]));
  const sorted = [...periods].sort((a, b) => b.startDate - a.startDate);

  if (sorted.length === 0) {
    return (
      <Text className="py-6 text-center text-sm text-text-secondary">
        {t('cycle.history.empty')}
      </Text>
    );
  }

  return (
    <View className="gap-3">
      {sorted.map((period) => {
        const entry = byStart.get(period.startDate);
        const excluded = entry?.status === 'excluded';
        const range =
          period.endDate != null
            ? `${date(period.startDate)} – ${date(period.endDate)}`
            : date(period.startDate);

        let durationChip: string;
        if (period.endKind === 'estimated') {
          durationChip = t('cycle.history.estimatedEnd');
        } else if (period.endKind === 'unknown') {
          durationChip = t('cycle.history.unknownEnd');
        } else if (period.endKind === 'open') {
          durationChip = t('cycle.history.ongoing');
        } else {
          durationChip = t('cycle.history.days', {
            count: entry?.durationDays ?? 0,
            days: formatInteger(entry?.durationDays ?? 0),
          });
        }

        return (
          <Pressable
            key={period.id}
            onPress={() => onEdit(period)}
            accessibilityRole="button"
            accessibilityLabel={`${range}. ${t('cycle.history.editHint')}`}
            className="rounded-2xl border-2 border-ink/5 bg-bg-card p-4"
            style={{ opacity: excluded ? 0.7 : 1 }}
          >
            <Text className="text-base font-bold text-text-primary">{range}</Text>
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              <Text
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: theme.colors.rose.brand10,
                  color: theme.colors.rose.brand,
                }}
              >
                {durationChip}
              </Text>
              {entry?.lengthDays != null ? (
                <Text className="text-xs text-text-secondary">
                  {t('cycle.history.cycleLength', {
                    count: entry.lengthDays,
                    days: formatInteger(entry.lengthDays),
                  })}
                </Text>
              ) : null}
            </View>
            {excluded && entry?.reason ? (
              <Text className="mt-2 text-xs text-text-tertiary">
                {t('cycle.history.notUsed', { reason: t(`cycle.history.reason.${entry.reason}`) })}
              </Text>
            ) : null}
            {period.note ? (
              <Text className="mt-2 text-xs text-text-secondary">{period.note}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
