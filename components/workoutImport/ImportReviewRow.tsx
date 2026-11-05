import { AlertCircle, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useTheme } from '@/hooks/useTheme';
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
  const theme = useTheme();
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

  const StatusIcon = unresolved ? AlertCircle : Check;
  const statusColor = unresolved ? theme.colors.status.warning : theme.colors.accent.primary;

  return (
    <View className="mx-4 mb-3 gap-3 rounded-card border border-border-light bg-bg-card p-4">
      <View className="gap-1">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text className="flex-1 text-base font-semibold text-text-primary" numberOfLines={2}>
            {match.name}
          </Text>
          <Text className="text-sm tabular-nums text-text-secondary">
            {t('workoutImport.review.setCount', { count: match.setCount })}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <StatusIcon size={theme.iconSize.sm} color={statusColor} />
          <Text className="flex-1 text-sm text-text-secondary" numberOfLines={2}>
            {outcome}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={t('workoutImport.review.chooseExercise')}
          variant="solid"
          role="button"
          onPress={onChoose}
        />
        {!choice || choice.kind !== 'create' ? (
          <Chip
            label={t('workoutImport.review.createCustom')}
            variant="solid"
            role="button"
            onPress={onCreate}
          />
        ) : null}
        {choice?.kind !== 'skip' ? (
          <Chip
            label={t('workoutImport.review.skip')}
            variant="solid"
            role="button"
            onPress={onSkip}
          />
        ) : null}
        {choice ? (
          <TextButton label={t('workoutImport.review.reset')} tone="muted" onPress={onClear} />
        ) : null}
      </View>

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
