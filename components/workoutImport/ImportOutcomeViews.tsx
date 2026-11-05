import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { ListGroup } from '@/components/theme/ListGroup';
import { ListRow } from '@/components/theme/ListRow';
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
  const theme = useTheme();
  return (
    <View className="items-center gap-3 px-6 py-16">
      <AlertCircle size={48} color={theme.colors.status.warning} />
      <Text className="text-center text-xl font-semibold text-text-primary">
        {t(
          failure === 'nothingNew'
            ? 'workoutImport.failure.nothingNewTitle'
            : 'workoutImport.failure.title'
        )}
      </Text>
      <Text className="text-center text-base text-text-secondary">
        {t(FAILURE_TEXT_KEY[failure])}
      </Text>
    </View>
  );
}

type ImportSummaryViewProps = {
  summary: ImportSummaryLike;
  skipped: readonly SkippedRow[];
};

export function ImportSummaryView({ summary, skipped }: ImportSummaryViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
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
    <View className="gap-6 px-4 py-8">
      <View className="items-center gap-3">
        <CheckCircle2 size={56} color={theme.colors.accent.primary} />
        <Text className="text-xl font-bold text-text-primary">
          {t('workoutImport.summary.title')}
        </Text>
      </View>
      <ListGroup>
        {lines.map((line) => (
          <ListRow key={line} variant="grouped" title={line} trailing={null} />
        ))}
      </ListGroup>
      {summary.timedSets > 0 ? (
        <Text className="text-sm text-text-secondary">{t('workoutImport.summary.timedSets')}</Text>
      ) : null}
    </View>
  );
}
