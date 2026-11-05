import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { MUSCLE_LABEL_KEYS } from '@/components/progress/muscleLoadCopy';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { MuscleSlug } from '@/utils/muscleGroupMapping';
import {
  type MuscleLoadEntry,
  pushPullComparison,
  quadHamstringComparison,
  WEEKLY_SETS_RANGE,
} from '@/utils/muscleLoad';

interface WeeklyMuscleSetsCardProps {
  load: ReadonlyMap<MuscleSlug, MuscleLoadEntry>;
}

/**
 * Weekly sets per muscle against the 10 to 20 range. States the numbers and where they fall; it
 * never calls a balance good or bad.
 */
export function WeeklyMuscleSetsCard({ load }: WeeklyMuscleSetsCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger, formatDecimal } = useFormatAppNumber();

  const rows = useMemo(
    () =>
      [...load.values()]
        .filter((entry) => entry.weeklySets > 0)
        .sort((a, b) => b.weeklySets - a.weeklySets),
    [load]
  );

  if (rows.length === 0) {
    return null;
  }

  const scale = Math.max(WEEKLY_SETS_RANGE.max, ...rows.map((row) => row.weeklySets));
  const rangeMinPercent = (WEEKLY_SETS_RANGE.min / scale) * 100;
  const rangeMaxPercent = (WEEKLY_SETS_RANGE.max / scale) * 100;

  const statusText = (status: MuscleLoadEntry['weeklyStatus']) => {
    if (status === 'below') {
      return t('muscleLoad.weekly.statusBelow', { min: formatInteger(WEEKLY_SETS_RANGE.min) });
    }

    if (status === 'above') {
      return t('muscleLoad.weekly.statusAbove', { max: formatInteger(WEEKLY_SETS_RANGE.max) });
    }

    return t('muscleLoad.weekly.statusWithin', {
      min: formatInteger(WEEKLY_SETS_RANGE.min),
      max: formatInteger(WEEKLY_SETS_RANGE.max),
    });
  };

  const setsText = (value: number) =>
    t('muscleLoad.weekly.setCount', { count: value, value: formatDecimal(value, 1) });

  const push = pushPullComparison(load);
  const quads = quadHamstringComparison(load);
  const pushPull = t('muscleLoad.weekly.pairLine', {
    first: t('muscleLoad.weekly.pushSets', {
      count: push.first,
      value: formatDecimal(push.first, 1),
    }),
    second: t('muscleLoad.weekly.pullSets', {
      count: push.second,
      value: formatDecimal(push.second, 1),
    }),
  });
  const quadsHamstrings = t('muscleLoad.weekly.pairLine', {
    first: t('muscleLoad.weekly.quadSets', {
      count: quads.first,
      value: formatDecimal(quads.first, 1),
    }),
    second: t('muscleLoad.weekly.hamstringSets', {
      count: quads.second,
      value: formatDecimal(quads.second, 1),
    }),
  });

  return (
    <GenericCard variant="flat">
      <View style={{ padding: 16 }}>
        <Text className="mb-4 text-lg font-semibold text-text-primary">
          {t('muscleLoad.weekly.title')}
        </Text>

        <View className="gap-4">
          {rows.map((row) => (
            <View key={row.slug} className="gap-1.5">
              <View className="flex-row items-baseline justify-between gap-3">
                <Text className="text-sm font-semibold text-text-primary">
                  {t(MUSCLE_LABEL_KEYS[row.slug])}
                </Text>
                <Text className="text-sm tabular-nums text-text-secondary">
                  {setsText(row.weeklySets)}
                </Text>
              </View>
              <View className="bg-background-secondary h-2 overflow-hidden rounded-tag">
                <View
                  className="h-full rounded-tag"
                  style={{
                    width: `${(row.weeklySets / scale) * 100}%`,
                    backgroundColor: theme.colors.accent.primary,
                  }}
                />
              </View>
              <View className="relative h-2">
                <View
                  className="absolute top-0 h-2 border-l border-border-default"
                  style={{ left: `${rangeMinPercent}%` }}
                />
                <View
                  className="absolute top-0 h-2 border-l border-border-default"
                  style={{ left: `${rangeMaxPercent}%` }}
                />
              </View>
              <Text className="text-xs text-text-tertiary">{statusText(row.weeklyStatus)}</Text>
            </View>
          ))}
        </View>

        <View className="mt-5 gap-1 border-t border-border-light pt-4">
          <Text className="text-sm text-text-secondary">{pushPull}</Text>
          <Text className="text-sm text-text-secondary">{quadsHamstrings}</Text>
        </View>

        <Text className="mt-4 text-xs text-text-tertiary">{t('muscleLoad.weekly.footnote')}</Text>
      </View>
    </GenericCard>
  );
}
