import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import type { ExerciseMatch } from '@/utils/workoutImport/exerciseMatch';
import type { ExerciseChoice } from '@/utils/workoutImport/importFlow';

type ImportReviewRowProps = {
  match: ExerciseMatch;
  choice: ExerciseChoice | undefined;
  onChoose: () => void;
  onCreate: () => void;
  onSkip: () => void;
  onClear: () => void;
  onRememberChange: (value: boolean) => void;
};

/** One exercise name from the file: what it is called there, and what it became. */
export function ImportReviewRow({
  match,
  choice,
  onChoose,
  onCreate,
  onSkip,
  onClear,
  onRememberChange,
}: ImportReviewRowProps) {
  const { t } = useTranslation();
  const unresolved = match.kind === 'unmatched' && !choice;

  let outcome: string;
  if (choice?.kind === 'pick') {
    outcome = choice.exerciseName;
  } else if (choice?.kind === 'create') {
    outcome = t('workoutImport.review.createCustom');
  } else if (choice?.kind === 'skip') {
    outcome = t('workoutImport.review.skip');
  } else {
    outcome = t('workoutImport.review.chooseExercise');
  }

  return (
    <View className="gap-3 border-b border-border-light px-4 py-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-text-primary">{match.name}</Text>
          <Text className="text-sm text-text-secondary">
            {t('workoutImport.review.setCount', { count: match.setCount })}
          </Text>
        </View>
        <Text className="max-w-[50%] text-right text-sm text-text-secondary">{outcome}</Text>
      </View>

      {unresolved ? (
        <View className="flex-row flex-wrap gap-2">
          <TextButton label={t('workoutImport.review.chooseExercise')} onPress={onChoose} />
          <TextButton label={t('workoutImport.review.createCustom')} onPress={onCreate} />
          <TextButton label={t('workoutImport.review.skip')} tone="muted" onPress={onSkip} />
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          <TextButton label={t('workoutImport.review.chooseExercise')} onPress={onChoose} />
          {choice ? (
            <TextButton label={t('workoutImport.review.skip')} tone="muted" onPress={onSkip} />
          ) : null}
          {choice ? (
            <TextButton label={t('workoutImport.review.reset')} tone="muted" onPress={onClear} />
          ) : null}
        </View>
      )}

      {choice?.kind === 'pick' ? (
        <ToggleInput
          items={[
            {
              key: 'remember',
              label: t('workoutImport.review.rememberName'),
              subtitle: t('workoutImport.review.rememberNameHint'),
              value: choice.rememberAlias,
              onValueChange: onRememberChange,
            },
          ]}
        />
      ) : null}
    </View>
  );
}
