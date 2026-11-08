import { AlertCircle, Check, ChevronDown, ChevronUp, MinusCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useTheme } from '@/hooks/useTheme';
import type { ExerciseMatch } from '@/utils/workoutImport/exerciseMatch';
import type { ExerciseChoice } from '@/utils/workoutImport/importFlow';

type ImportReviewRowProps = {
  match: ExerciseMatch;
  choice: ExerciseChoice | undefined;
  /** A settled row shows its actions only while open. An unsettled row always shows them. */
  expanded: boolean;
  onToggle: () => void;
  onChoose: () => void;
  onCreate: () => void;
  onSkip: () => void;
  onClear: () => void;
  onRememberChange: (value: boolean) => void;
};

/** One exercise name from the file: what it is called there, and what it becomes. */
export function ImportReviewRow({
  match,
  choice,
  expanded,
  onToggle,
  onChoose,
  onCreate,
  onSkip,
  onClear,
  onRememberChange,
}: ImportReviewRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const setCount = t('workoutImport.review.setCount', { count: match.setCount });

  const actions = (
    <View className="flex-row gap-2">
      <View className="flex-1">
        <Button
          label={t('workoutImport.review.choose')}
          accessibilityLabel={`${t('workoutImport.review.chooseExercise')}: ${match.name}`}
          variant="secondary"
          size="sm"
          width="full"
          onPress={onChoose}
        />
      </View>
      <View className="flex-1">
        <Button
          label={t('workoutImport.review.create')}
          accessibilityLabel={`${t('workoutImport.review.createCustom')}: ${match.name}`}
          variant="secondary"
          size="sm"
          width="full"
          onPress={onCreate}
        />
      </View>
      <View className="flex-1">
        <Button
          label={t('workoutImport.review.skip')}
          accessibilityLabel={`${t('workoutImport.review.skip')}: ${match.name}`}
          variant="secondary"
          size="sm"
          width="full"
          onPress={onSkip}
        />
      </View>
    </View>
  );

  if (!choice) {
    return (
      <View className="mx-4 mb-3 gap-3 rounded-card border border-border-light bg-bg-card p-4">
        <View className="flex-row items-start gap-3">
          <AlertCircle size={theme.iconSize.md} color={theme.colors.status.warning} />
          <View className="min-w-0 flex-1">
            <Text className="text-lg font-semibold text-text-primary" numberOfLines={2}>
              {match.name}
            </Text>
            <Text className="text-sm tabular-nums text-text-secondary">{setCount}</Text>
          </View>
        </View>
        {actions}
      </View>
    );
  }

  let outcome: string;
  if (choice.kind === 'existing') {
    outcome = choice.exerciseName;
  } else if (choice.kind === 'create') {
    outcome = t('workoutImport.review.createCustom');
  } else {
    outcome = t('workoutImport.review.skipped');
  }

  const skipped = choice.kind === 'skip';
  const StatusIcon = skipped ? MinusCircle : Check;
  const ToggleIcon = expanded ? ChevronUp : ChevronDown;

  return (
    <View className="border-b border-border-light">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${match.name}: ${outcome}, ${setCount}`}
        className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-ink/5"
        onPress={onToggle}
      >
        <StatusIcon
          size={theme.iconSize.md}
          color={skipped ? theme.colors.text.tertiary : theme.colors.accent.primary}
        />
        <View className="min-w-0 flex-1">
          <Text className="text-base font-medium text-text-primary" numberOfLines={2}>
            {match.name}
          </Text>
          <Text className="text-sm text-text-secondary" numberOfLines={2}>
            {outcome}
          </Text>
        </View>
        <Text className="text-sm tabular-nums text-text-secondary">{setCount}</Text>
        <ToggleIcon size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
      </Pressable>

      {expanded ? (
        <View className="gap-3 px-4 pb-4">
          {actions}
          {choice.kind === 'existing' ? (
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
          <TextButton
            label={t('workoutImport.review.reset')}
            tone="muted"
            align="center"
            onPress={onClear}
          />
        </View>
      ) : null}
    </View>
  );
}
