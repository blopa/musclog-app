import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { LOGGY_FAILURE_POSE, LoggyPose } from '@/components/LoggyPose';
import { StatStrip, type StatStripItem } from '@/components/StatStrip';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { ImportFailureKind } from '@/utils/workoutImport/importFlow';
import type { ImportSummary, SkippedRow } from '@/utils/workoutImport/types';

/** Whole keys, so the translation scanner sees every failure. */
const FAILURE_TEXT_KEY = {
  empty: 'workoutImport.failure.empty',
  unknownFormat: 'workoutImport.failure.unknownFormat',
  readFailed: 'workoutImport.failure.readFailed',
  noRows: 'workoutImport.failure.noRows',
  tooLarge: 'workoutImport.failure.tooLarge',
  nothingNew: 'workoutImport.failure.nothingNew',
} as const satisfies Record<ImportFailureKind, string>;

const OUTCOME_POSE_HEIGHT = 220;

export function ImportSavingView({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const theme = useTheme();
  const share = total > 0 ? Math.min(1, done / total) : 0;

  return (
    <View className="items-center gap-5 px-6 py-10">
      <LoggyPose pose="running" height={OUTCOME_POSE_HEIGHT} />
      <Text className="text-center text-xl font-semibold tabular-nums text-text-primary">
        {t('workoutImport.saving.progress', {
          done: formatInteger(done),
          total: formatInteger(total),
        })}
      </Text>
      <View className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
        <View
          className="h-full rounded-full"
          style={{
            backgroundColor: theme.colors.accent.primary,
            width: `${Math.round(share * 100)}%`,
          }}
        />
      </View>
      <Text className="text-center text-base text-text-secondary">
        {t('workoutImport.saving.keepOpen')}
      </Text>
    </View>
  );
}

export function ImportFailedView({ failure }: { failure: ImportFailureKind }) {
  const { t } = useTranslation();
  // Nothing new is good news: everything is already here, so Loggy can relax. Every other failure
  // is a file that did not fit, which is not an emergency, so he is puzzled, never in a panic.
  const nothingNew = failure === 'nothingNew';

  return (
    <View className="items-center gap-3 px-6 py-10">
      <LoggyPose pose={nothingNew ? 'coffee' : LOGGY_FAILURE_POSE} height={OUTCOME_POSE_HEIGHT} />
      <Text className="mt-2 text-center text-2xl font-bold text-text-primary">
        {t(nothingNew ? 'workoutImport.failure.nothingNewTitle' : 'workoutImport.failure.title')}
      </Text>
      <Text className="text-center text-base text-text-secondary">
        {t(FAILURE_TEXT_KEY[failure])}
      </Text>
    </View>
  );
}

type ImportSummaryViewProps = {
  summary: ImportSummary;
  skipped: readonly SkippedRow[];
};

export function ImportSummaryView({ summary, skipped }: ImportSummaryViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();

  const stat = (key: string, value: number, label: string): StatStripItem => ({
    key,
    value: formatInteger(value),
    label,
    valueColor: theme.colors.text.primary,
  });

  const stats = [
    stat('sets', summary.setsImported, t('workoutImport.summary.setsLabel')),
    ...(summary.exercisesCreated > 0
      ? [stat('created', summary.exercisesCreated, t('workoutImport.summary.exercisesLabel'))]
      : []),
    ...(summary.sessionsAlreadyHere > 0
      ? [stat('here', summary.sessionsAlreadyHere, t('workoutImport.summary.alreadyHereLabel'))]
      : []),
    ...(skipped.length > 0
      ? [stat('skipped', skipped.length, t('workoutImport.summary.rowsSkippedLabel'))]
      : []),
  ];

  return (
    <View className="gap-6 px-4 py-8">
      <View className="items-center gap-3">
        <LoggyPose pose="celebrating" height={OUTCOME_POSE_HEIGHT} />
        <Text className="text-center text-2xl font-bold text-text-primary">
          {t('workoutImport.summary.sessionsImported', { count: summary.sessionsImported })}
        </Text>
      </View>
      <StatStrip
        size="lg"
        items={stats}
        palette={{
          background: theme.colors.background.card,
          border: theme.colors.border.light,
          label: theme.colors.text.secondary,
          unit: theme.colors.text.secondary,
        }}
      />
      {summary.timedSets > 0 ? (
        <Text className="text-center text-base text-text-secondary">
          {t('workoutImport.summary.timedSets')}
        </Text>
      ) : null}
    </View>
  );
}
