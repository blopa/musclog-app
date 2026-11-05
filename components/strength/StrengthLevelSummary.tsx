import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { TextButton } from '@/components/theme/TextButton';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { STRENGTH_LEVELS, type StrengthGrade, type StrengthLevel } from '@/utils/strengthLevel';
import {
  nextLevelDisplay,
  strengthLevelIndex,
  strengthLevelWording,
} from '@/utils/strengthLevelDisplay';
import { getWeightUnitI18nKey } from '@/utils/units';

export const OPENPOWERLIFTING_URL = 'https://www.openpowerlifting.org';

/** Whole keys, so the translation scanner sees every label. */
const LEVEL_LABEL_KEYS: Record<
  StrengthLevel,
  | 'strengthLevels.levels.beginner'
  | 'strengthLevels.levels.novice'
  | 'strengthLevels.levels.intermediate'
  | 'strengthLevels.levels.advanced'
  | 'strengthLevels.levels.elite'
> = {
  beginner: 'strengthLevels.levels.beginner',
  novice: 'strengthLevels.levels.novice',
  intermediate: 'strengthLevels.levels.intermediate',
  advanced: 'strengthLevels.levels.advanced',
  elite: 'strengthLevels.levels.elite',
};

type StrengthLevelSummaryProps = {
  exerciseId: string;
  grade: StrengthGrade;
};

/**
 * A lift's level in words, a five-step scale, and the weight for the next level. The level is
 * always spelled out, so the scale's fill is never the only signal.
 */
export function StrengthLevelSummary({ exerciseId, grade }: StrengthLevelSummaryProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { unitsFor } = useExerciseUserSettings();
  const { formatDecimal } = useFormatAppNumber();

  const units = unitsFor(exerciseId);
  const wording = strengthLevelWording(grade);
  const lowest = wording.kind === 'single' ? wording.level : wording.lower;
  const filledSteps = strengthLevelIndex(lowest) + 1;

  const label =
    wording.kind === 'single'
      ? t(LEVEL_LABEL_KEYS[wording.level])
      : t('strengthLevels.rangeLabel', {
          lower: t(LEVEL_LABEL_KEYS[wording.lower]),
          upper: t(LEVEL_LABEL_KEYS[wording.upper]),
        });

  const nextLine =
    grade.nextLevel !== null && grade.nextLevelKg !== null
      ? t('strengthLevels.nextLevel', {
          value: formatDecimal(nextLevelDisplay(grade.nextLevelKg, units), 1),
          unit: t(getWeightUnitI18nKey(units)),
        })
      : null;

  return (
    <View className="gap-2" accessible accessibilityLabel={label}>
      <Text className="text-base font-semibold text-text-primary">{label}</Text>
      <View className="flex-row gap-1" accessible={false}>
        {STRENGTH_LEVELS.map((step, index) => (
          <View
            key={step}
            className="h-1.5 flex-1 rounded-tag"
            style={{
              backgroundColor:
                index < filledSteps ? theme.colors.accent.primary : theme.colors.border.light,
            }}
          />
        ))}
      </View>
      {wording.kind === 'range' ? (
        <Text className="text-xs text-text-secondary">{t('strengthLevels.otherNote')}</Text>
      ) : null}
      {nextLine ? <Text className="text-sm text-text-secondary">{nextLine}</Text> : null}
    </View>
  );
}

/** The attribution line that goes wherever a level is shown. */
export function StrengthSourceNote() {
  const { t } = useTranslation();

  return (
    <View className="gap-1">
      <Text className="text-xs text-text-secondary">{t('strengthLevels.sourceNote')}</Text>
      <TextButton
        label={t('strengthLevels.sourceLink')}
        tone="muted"
        onPress={() => {
          Linking.openURL(OPENPOWERLIFTING_URL).catch(() => {});
        }}
      />
    </View>
  );
}
