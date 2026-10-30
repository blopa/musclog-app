import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { ComebackNutritionService } from '@/database/services/ComebackNutritionService';
import { ComebackService } from '@/database/services/ComebackService';
import { type ComebackKey, FEEL_LABEL_KEYS } from '@/utils/comeback/comebackCopy';
import type {
  ComebackAnswers,
  ComebackCheckpointWeek,
  ComebackNutritionGoal,
} from '@/utils/comeback/comebackState';
import { COMEBACK_FEELS } from '@/utils/comeback/comebackState';
import { handleError } from '@/utils/handleError';

/** What week 12 offers for what comes next, and the nutrition goal each one means. */
export const NEXT_PHASE_CHOICES: {
  id: string;
  labelKey: ComebackKey;
  goal: ComebackNutritionGoal;
}[] = [
  { id: 'keepLosing', labelKey: 'comeback.reflection.keepLosing', goal: 'loseSlowly' },
  { id: 'maintain', labelKey: 'comeback.reflection.maintain', goal: 'regular' },
  { id: 'performance', labelKey: 'comeback.reflection.performance', goal: 'rebuild' },
];

/**
 * The reflections after the ramp (weeks 8 and 12): "how did this week feel?" and, at 12, what the
 * next phase is. Weeks 2 and 4 are answered in the Weekly Review, where they clear its badge.
 */
export function ComebackReflection({
  week,
  answers,
  includesNutrition,
}: {
  week: ComebackCheckpointWeek;
  answers: ComebackAnswers;
  includesNutrition: boolean;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      await handleError(error, 'comebackReflection', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setBusy(false);
    }
  };

  const chooseNext = (goal: ComebackNutritionGoal) =>
    run(async () => {
      const next = { ...answers, nutritionGoal: goal };
      await ComebackService.updateAnswers({ answers: { nutritionGoal: goal } });
      // Keep losing needs nothing new; the other two return the targets to maintenance.
      if (goal !== 'loseSlowly') {
        await ComebackNutritionService.apply(next, { applyDeficit: false });
      }
    });

  return (
    <View
      className="gap-3 rounded-card border border-border-light bg-bg-card p-4"
      testID={`comeback-reflection-${week}`}
    >
      <Text className="text-base font-semibold text-text-primary">
        {t('comeback.reflection.title', { week })}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {COMEBACK_FEELS.map((feel) => (
          <Chip
            key={feel}
            label={t(FEEL_LABEL_KEYS[feel])}
            selected={false}
            disabled={busy}
            onPress={() => void run(() => ComebackService.answerCheckpoint(week, feel))}
            testID={`comeback-feel-${week}-${feel}`}
          />
        ))}
      </View>
      {week === 12 && includesNutrition ? (
        <View className="gap-2">
          <Text className="text-sm text-text-secondary">{t('comeback.reflection.nextPhase')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {NEXT_PHASE_CHOICES.map((choice) => (
              <Chip
                key={choice.id}
                label={t(choice.labelKey)}
                selected={answers.nutritionGoal === choice.goal}
                disabled={busy}
                onPress={() => void chooseNext(choice.goal)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
