import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { ImportFailureKind, ImportSummaryLike } from '@/utils/workoutImport/importFlow';
import type { SkippedRow } from '@/utils/workoutImport/types';

/** Whole keys, so the translation scanner sees every failure. */
const FAILURE_TEXT_KEY = {
  empty: 'workoutImport.failure.empty',
  unknownFormat: 'workoutImport.failure.unknownFormat',
  readFailed: 'workoutImport.failure.readFailed',
  noRows: 'workoutImport.failure.noRows',
  tooLarge: 'workoutImport.failure.tooLarge',
  nothingNew: 'workoutImport.failure.nothingNew',
} as const satisfies Record<ImportFailureKind, string>;

export function ImportSavingView({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const theme = useTheme();

  return (
    <View className="items-center gap-4 px-4 py-12">
      <ActivityIndicator color={theme.colors.accent.primary} size="large" />
      <Text className="text-base font-semibold text-text-primary">
        {t('workoutImport.saving.progress', {
          done: formatInteger(done),
          total: formatInteger(total),
        })}
      </Text>
      <Text className="text-center text-sm text-text-secondary">
        {t('workoutImport.saving.keepOpen')}
      </Text>
    </View>
  );
}

export function ImportFailedView({ failure }: { failure: ImportFailureKind }) {
  const { t } = useTranslation();
  return (
    <View className="gap-3 px-4 py-12">
      <Text className="text-lg font-semibold text-text-primary">
        {t(
          failure === 'nothingNew'
            ? 'workoutImport.failure.nothingNewTitle'
            : 'workoutImport.failure.title'
        )}
      </Text>
      <Text className="text-base text-text-secondary">{t(FAILURE_TEXT_KEY[failure])}</Text>
    </View>
  );
}

type ImportSummaryViewProps = {
  summary: ImportSummaryLike;
  skipped: readonly SkippedRow[];
};

export function ImportSummaryView({ summary, skipped }: ImportSummaryViewProps) {
  const { t } = useTranslation();
  const lines: string[] = [
    t('workoutImport.summary.sessionsImported', { count: summary.sessionsImported }),
    t('workoutImport.summary.setsImported', { count: summary.setsImported }),
  ];
  if (summary.exercisesCreated > 0) {
    lines.push(t('workoutImport.summary.exercisesCreated', { count: summary.exercisesCreated }));
  }

  if (summary.sessionsAlreadyHere > 0) {
    lines.push(t('workoutImport.summary.alreadyHere', { count: summary.sessionsAlreadyHere }));
  }

  if (skipped.length > 0) {
    lines.push(t('workoutImport.summary.rowsSkipped', { count: skipped.length }));
  }

  return (
    <View className="gap-4 px-4 py-6">
      <Text className="text-lg font-semibold text-text-primary">
        {t('workoutImport.summary.title')}
      </Text>
      <View className="gap-2">
        {lines.map((line) => (
          <Text key={line} className="text-base text-text-primary">
            {line}
          </Text>
        ))}
      </View>
      {summary.timedSets > 0 ? (
        <Text className="text-sm text-text-secondary">{t('workoutImport.summary.timedSets')}</Text>
      ) : null}
    </View>
  );
}
