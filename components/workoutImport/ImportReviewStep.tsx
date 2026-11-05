import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Text, View } from 'react-native';

import { SectionLabel } from '@/components/theme/SectionLabel';
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

  const unresolved = needsChoice.filter((match) => !props.choices[match.name]).length;

  const skipReasons = [...new Set(props.skipped.map((row) => row.reason))];

  const header = (
    <View className="gap-2 px-4 py-4">
      <Text className="text-base text-text-primary">
        {t('workoutImport.review.newSessions', { count: props.newCount })}
      </Text>
      {props.alreadyHereCount > 0 ? (
        <Text className="text-sm text-text-secondary">
          {t('workoutImport.review.alreadyHere', { count: props.alreadyHereCount })}
        </Text>
      ) : null}
      {props.skipped.length > 0 ? (
        <Text className="text-sm text-text-secondary">
          {t('workoutImport.review.rowsSkipped', { count: props.skipped.length })}{' '}
          {t('workoutImport.review.skippedReasons', {
            reasons: skipReasons.map((reason) => t(SKIP_REASON_TEXT_KEY[reason])).join(', '),
          })}
        </Text>
      ) : null}
      {props.loading ? (
        <Text className="text-sm text-text-secondary">{t('workoutImport.review.matching')}</Text>
      ) : (
        <UnresolvedNotice count={unresolved} />
      )}
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.key}
      ListHeaderComponent={header}
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

function UnresolvedNotice({ count }: { count: number }) {
  const { t } = useTranslation();
  if (count === 0) {
    return null;
  }

  return (
    <Text className="text-sm font-semibold text-status-warning">
      {t('workoutImport.review.unresolved', { count })}
    </Text>
  );
}
