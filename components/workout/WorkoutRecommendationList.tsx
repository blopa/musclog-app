import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { TemplateRecommendation } from '@/database/services/WorkoutProgressionService';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { getWeightUnitI18nKey } from '@/utils/units';

import { GuidanceBadgeLine } from './session/GuidanceSummary';
import { useAdjustmentMessage } from './useAdjustmentMessage';

/** What to say when nothing changed: the rule, missing history, or holding last time's targets. */
function fallbackHintKey(row: TemplateRecommendation) {
  if (row.rule) {
    return 'progression.followRule';
  }
  return row.status === 'learning' ? 'progression.learningHint' : 'progression.holdHint';
}

function RecommendationRow({ row }: { row: TemplateRecommendation }) {
  const { t } = useTranslation();
  const { unitsFor } = useExerciseUserSettings();
  const { locale, formatInteger } = useFormatAppNumber();
  const units = unitsFor(row.exercise.id);
  const message = useAdjustmentMessage(row.changes[0]?.adjustment, units);
  const changed = new Set(row.changes.map((change) => change.setId));
  const weightUnit = t(getWeightUnitI18nKey(units));
  // "160 lb × 10", the order the explanation sentence uses. A single unit after all the chips read
  // as "160 × 10 lb" — the unit attached to the reps.
  const load = (weightKg: number, reps: number) =>
    `${formatDisplayWeightKg(locale, units, weightKg)} ${weightUnit} × ${formatInteger(reps, { useGrouping: false })}`;
  const previous = row.sets
    .map((_, index) => row.previous?.sets.find((set, i) => (set.prescribedIndex ?? i) === index))
    .filter((set): set is NonNullable<typeof set> => set != null);

  return (
    <View className="gap-2.5 rounded-xl border border-border-light bg-bg-secondary p-3">
      <View className="gap-1.5">
        <Text className="text-base font-bold text-text-primary" numberOfLines={2}>
          {row.exercise.name}
        </Text>
        <GuidanceBadgeLine state={row.status} rule={row.rule} />
      </View>
      <View className="flex-row flex-wrap items-center gap-1.5">
        {row.sets.map((set) => (
          <View
            key={set.id}
            className={`rounded-lg px-2.5 py-1.5 ${changed.has(set.id) ? 'bg-accent-primary/10' : 'bg-bg-overlay'}`}
          >
            <Text
              className={`text-sm font-semibold ${changed.has(set.id) ? 'text-accent-primary' : 'text-text-primary'}`}
            >
              {load(set.weight, set.reps)}
            </Text>
          </View>
        ))}
      </View>
      {previous.length ? (
        <Text className="text-xs text-text-secondary" numberOfLines={2}>
          {t('trainingFlow.lastTimeList', {
            sets: previous.map((set) => load(set.weightKg, set.reps)).join(' · '),
          })}
        </Text>
      ) : null}
      <Text className="text-sm leading-5 text-text-secondary">
        {message ?? t(fallbackHintKey(row))}
      </Text>
    </View>
  );
}

/**
 * What an exercise's next session will ask for, and why — one read-only projection shared by the
 * workout preview, "Next time" on the summary and the Weekly Review, so all three agree.
 */
export function WorkoutRecommendationList({
  recommendations,
}: {
  recommendations: TemplateRecommendation[];
}) {
  return (
    <View className="gap-3" testID="workout-recommendations">
      {recommendations.map((row) => (
        <RecommendationRow key={row.templateExerciseId} row={row} />
      ))}
    </View>
  );
}
