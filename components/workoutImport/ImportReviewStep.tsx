import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Text, View } from 'react-native';

import { StatStrip, type StatStripItem } from '@/components/StatStrip';
import { SectionLabel } from '@/components/theme/SectionLabel';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { ExerciseMatch } from '@/utils/workoutImport/exerciseMatch';
import { type ExerciseChoice, reviewSections } from '@/utils/workoutImport/importFlow';
import type { SkippedRow, SkipReason } from '@/utils/workoutImport/types';

import { ImportReviewRow } from './ImportReviewRow';

type ImportReviewStepProps = {
  matches: readonly ExerciseMatch[];
  loading: boolean;
  choices: Readonly<Record<string, ExerciseChoice>>;
  newCount: number;
  alreadyHereCount: number;
  skipped: readonly SkippedRow[];
  onChoose: (name: string) => void;
  onCreate: (name: string) => void;
  onSkip: (name: string) => void;
  onClear: (name: string) => void;
  onRememberChange: (name: string, value: boolean) => void;
};

/** Whole keys, so the translation scanner sees every reason. */
const SKIP_REASON_TEXT_KEY = {
  badDate: 'workoutImport.skipReason.badDate',
  futureDate: 'workoutImport.skipReason.futureDate',
  noExercise: 'workoutImport.skipReason.noExercise',
  nothingMeasured: 'workoutImport.skipReason.nothingMeasured',
  outOfRange: 'workoutImport.skipReason.outOfRange',
} as const satisfies Record<SkipReason, string>;

type ListItem =
  | { type: 'header'; key: string; titleKey: 'needsChoice' | 'matched' }
  | { type: 'row'; key: string; match: ExerciseMatch };

export function ImportReviewStep(props: ImportReviewStepProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { needsChoice, matched } = useMemo(() => reviewSections(props.matches), [props.matches]);

  const items = useMemo<ListItem[]>(() => {
    const out: ListItem[] = [];
    if (needsChoice.length > 0) {
      out.push({ type: 'header', key: 'h-needs', titleKey: 'needsChoice' });
      out.push(
        ...needsChoice.map((match) => ({ type: 'row' as const, key: `r-${match.name}`, match }))
      );
    }

    if (matched.length > 0) {
      out.push({ type: 'header', key: 'h-matched', titleKey: 'matched' });
      out.push(
        ...matched.map((match) => ({ type: 'row' as const, key: `r-${match.name}`, match }))
      );
    }

    return out;
  }, [needsChoice, matched]);

  const [openRow, setOpenRow] = useState<string | null>(null);
  const { formatInteger } = useFormatAppNumber();

  const unresolved = needsChoice.filter((match) => !props.choices[match.name]).length;
  const settled = props.matches.filter((match) => {
    const choice = props.choices[match.name];
    return choice !== undefined && choice.kind !== 'skip';
  }).length;
  const skipReasons = [...new Set(props.skipped.map((row) => row.reason))];

  const stat = (key: string, value: number, label: string, color?: string): StatStripItem => ({
    key,
    value: formatInteger(value),
    label,
    valueColor: color ?? theme.colors.text.primary,
  });

  const stats = [
    stat('matched', settled, t('workoutImport.review.matched')),
    stat(
      'unresolved',
      unresolved,
      t('workoutImport.review.needsChoice'),
      unresolved > 0 ? theme.colors.status.warning : undefined
    ),
    ...(props.alreadyHereCount > 0
      ? [stat('here', props.alreadyHereCount, t('workoutImport.review.alreadyHereLabel'))]
      : []),
  ];

  const header = (
    <View className="gap-4 px-4 pb-2 pt-4">
      <Text className="text-2xl font-bold text-text-primary">
        {t('workoutImport.review.newSessions', { count: props.newCount })}
      </Text>
      {props.loading ? (
        <Text className="text-base text-text-secondary">{t('workoutImport.review.matching')}</Text>
      ) : (
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
      )}
      {props.skipped.length > 0 ? (
        <Text className="text-sm text-text-secondary">
          {t('workoutImport.review.rowsSkipped', { count: props.skipped.length })}{' '}
          {t('workoutImport.review.skippedReasons', {
            reasons: skipReasons.map((reason) => t(SKIP_REASON_TEXT_KEY[reason])).join(', '),
          })}
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.key}
      ListHeaderComponent={header}
      // The modal's footer is overlaid on the list, so leave room to scroll past it.
      contentContainerStyle={{ paddingBottom: theme.spacing.padding['4xl'] }}
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={7}
      renderItem={({ item }) => {
        if (item.type === 'header') {
          return (
            <View className="px-4 pb-2 pt-4">
              <SectionLabel>
                {item.titleKey === 'needsChoice'
                  ? t('workoutImport.review.needsChoice')
                  : t('workoutImport.review.matched')}
              </SectionLabel>
            </View>
          );
        }

        const { match } = item;
        return (
          <ImportReviewRow
            match={match}
            choice={props.choices[match.name]}
            expanded={openRow === match.name}
            onToggle={() => setOpenRow(openRow === match.name ? null : match.name)}
            onChoose={() => props.onChoose(match.name)}
            onCreate={() => props.onCreate(match.name)}
            onSkip={() => props.onSkip(match.name)}
            onClear={() => props.onClear(match.name)}
            onRememberChange={(value) => props.onRememberChange(match.name, value)}
          />
        );
      }}
    />
  );
}
