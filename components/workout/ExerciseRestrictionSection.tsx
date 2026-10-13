import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { Chip } from '@/components/theme/Chip';
import {
  INJURY_EXPIRY_LABEL_KEYS,
  RESTRICTION_CHOICE_KEYS,
} from '@/components/workout/restrictionLabelKeys';
import {
  ExerciseRestrictionService,
  MAX_EXERCISE_RESTRICTIONS,
} from '@/database/services/ExerciseRestrictionService';
import { useExerciseRestrictions } from '@/hooks/useExerciseRestrictions';
import { useTheme } from '@/hooks/useTheme';
import {
  INJURY_EXPIRY_OPTIONS,
  type InjuryExpiryOption,
  injuryExpiryOptionFor,
  injuryExpiryTimestamp,
  type RestrictionKind,
} from '@/utils/exerciseSubstitution';

type ExerciseRestrictionSectionProps = {
  exerciseId: string;
};

type Choice = RestrictionKind | 'allow';
const CHOICES: readonly Choice[] = ['allow', 'dislike', 'injury', 'never'];

/**
 * Whether the app may suggest this exercise: normally, reluctantly (dislike), not for now (injury,
 * which can heal) or never. Every choice is applied the moment it is tapped — there is no Save,
 * so what the control shows is always what the swap list and the AI plan will do.
 */
export function ExerciseRestrictionSection({ exerciseId }: ExerciseRestrictionSectionProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { rows } = useExerciseRestrictions();
  const [error, setError] = useState<string | null>(null);
  const [pendingExpiry, setPendingExpiry] = useState<InjuryExpiryOption>('4w');

  const row = rows.find((candidate) => candidate.exerciseId === exerciseId);
  const choice: Choice = row?.kind ?? 'allow';
  const explainKey = RESTRICTION_CHOICE_KEYS[choice].explain;
  // An existing injury shows the option closest to its stored end date.
  const expiry: InjuryExpiryOption =
    row?.kind === 'injury' ? injuryExpiryOptionFor(row.expiresAt) : pendingExpiry;

  const apply = async (next: Choice, nextExpiry: InjuryExpiryOption = expiry) => {
    setError(null);
    try {
      if (next === 'allow') {
        await ExerciseRestrictionService.clear(exerciseId);
        return;
      }

      const result = await ExerciseRestrictionService.set(exerciseId, next, {
        expiresAt: next === 'injury' ? injuryExpiryTimestamp(nextExpiry) : null,
      });
      if (!result.ok) {
        setError(t('workoutSettings.restrictions.limit', { count: MAX_EXERCISE_RESTRICTIONS }));
      }
    } catch {
      setError(t('exercises.viewExercise.restriction.failed'));
    }
  };

  const chip = (selected: boolean, label: string, onPress: () => void, key: string) => (
    <Chip key={key} selected={selected} onPress={onPress} label={label} />
  );

  return (
    <View className="px-4 pb-6 pt-2" testID="exercise-restriction-section">
      <Text className="mb-1 text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
        {t('exercises.viewExercise.restriction.title')}
      </Text>
      <Text className="mb-4 text-sm" style={{ color: theme.colors.text.secondary }}>
        {t('exercises.viewExercise.restriction.hint')}
      </Text>
      <GenericCard variant="flat">
        <View className="gap-4 p-4">
          <View className="flex-row flex-wrap gap-2">
            {CHOICES.map((option) =>
              chip(
                choice === option,
                t(RESTRICTION_CHOICE_KEYS[option].label),
                () => void apply(option),
                option
              )
            )}
          </View>

          {choice === 'injury' ? (
            <View className="gap-2">
              <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
                {t('exercises.viewExercise.restriction.expiryLabel')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {INJURY_EXPIRY_OPTIONS.map((option) =>
                  chip(
                    expiry === option,
                    t(INJURY_EXPIRY_LABEL_KEYS[option]),
                    () => {
                      setPendingExpiry(option);
                      void apply('injury', option);
                    },
                    option
                  )
                )}
              </View>
            </View>
          ) : null}

          {explainKey ? (
            <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
              {t(explainKey)}
            </Text>
          ) : null}
          {error ? (
            <Text className="text-sm" style={{ color: theme.colors.status.error }}>
              {error}
            </Text>
          ) : null}
        </View>
      </GenericCard>
    </View>
  );
}
