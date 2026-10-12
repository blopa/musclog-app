import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { TemplateRecommendation } from '@/database/services/WorkoutProgressionService';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';

import { SetAdjustmentNotice } from './SetAdjustmentNotice';

export function WorkoutRecommendationList({
  recommendations,
}: {
  recommendations: TemplateRecommendation[];
}) {
  const { t, i18n } = useTranslation();
  const { unitsFor } = useExerciseUserSettings();
  return (
    <View className="gap-4" testID="workout-recommendations">
      {recommendations.map((row) => {
        const units = unitsFor(row.exercise.id);
        return (
          <View key={row.templateExerciseId} className="gap-2 rounded-xl bg-bg-cardElevated p-3">
            <Text className="font-semibold text-text-primary">{row.exercise.name}</Text>
            <Text className="text-sm text-accent-primary">
              {t(`progression.methods.${row.rule?.type ?? 'automatic'}`)} ·{' '}
              {t(`progression.states.${row.status}`)}
            </Text>
            {row.sets.map((set, index) => (
              <View key={set.id} className="gap-1">
                <Text className="text-text-primary">
                  {t('trainingFlow.setLabel', { number: index + 1 })}:{' '}
                  {formatDisplayWeightKg(i18n.resolvedLanguage ?? i18n.language, units, set.weight)}{' '}
                  {units === 'imperial' ? 'lb' : 'kg'} × {set.reps}
                </Text>
                {row.previous?.sets.find(
                  (previous, i) => (previous.prescribedIndex ?? i) === index
                ) ? (
                  <Text className="text-xs text-text-secondary">
                    {t('trainingFlow.previous', {
                      weight: formatDisplayWeightKg(
                        i18n.resolvedLanguage ?? i18n.language,
                        units,
                        row.previous.sets.find(
                          (previous, i) => (previous.prescribedIndex ?? i) === index
                        )!.weightKg
                      ),
                      reps: row.previous.sets.find(
                        (previous, i) => (previous.prescribedIndex ?? i) === index
                      )!.reps,
                      unit: units === 'imperial' ? 'lb' : 'kg',
                    })}
                  </Text>
                ) : null}
              </View>
            ))}
            {row.changes[0] ? (
              <SetAdjustmentNotice adjustment={row.changes[0].adjustment} units={units} />
            ) : (
              <Text className="text-xs text-text-secondary">
                {t(row.rule ? 'progression.followRule' : 'progression.learningHint')}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
