import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { StatStrip, type StatStripItem } from '@/components/StatStrip';
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
import { kgToDisplay } from '@/utils/unitConversion';
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
  estimated1RmKg: number;
};

/**
 * A lift's level in words, a five-step scale, and where the lift stands against the next level.
 * The level is always spelled out, so the scale's fill is never the only signal.
 */
export function StrengthLevelSummary({
  exerciseId,
  grade,
  estimated1RmKg,
}: StrengthLevelSummaryProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { unitsFor } = useExerciseUserSettings();
  const { formatDecimal } = useFormatAppNumber();

  const units = unitsFor(exerciseId);
  const unit = t(getWeightUnitI18nKey(units));
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

  const stats: StatStripItem[] = [
    {
      key: 'current',
      value: formatDecimal(kgToDisplay(estimated1RmKg, units), 1),
      unit,
      label: t('strengthLevels.estimated1rm'),
      valueColor: theme.colors.text.primary,
    },
    ...(grade.nextLevel !== null && grade.nextLevelKg !== null
      ? [
          {
            key: 'next',
            value: formatDecimal(nextLevelDisplay(grade.nextLevelKg, units), 1),
            unit,
            label: t('strengthLevels.toReach', { level: t(LEVEL_LABEL_KEYS[grade.nextLevel]) }),
            valueColor: theme.colors.accent.primary,
          },
        ]
      : []),
  ];

  return (
    <View className="gap-3">
      <View className="gap-2" accessible accessibilityLabel={label}>
        <Text className="text-2xl font-bold text-text-primary">{label}</Text>
        <View className="flex-row gap-1" accessible={false}>
          {STRENGTH_LEVELS.map((step, index) => (
            <View
              key={step}
              className="h-2.5 flex-1 rounded-tag"
              style={{
                backgroundColor:
                  index < filledSteps ? theme.colors.accent.primary : theme.colors.border.light,
              }}
            />
          ))}
        </View>
        <View className="flex-row justify-between" accessible={false}>
          <Text className="text-sm text-text-secondary">{t(LEVEL_LABEL_KEYS.beginner)}</Text>
          <Text className="text-sm text-text-secondary">{t(LEVEL_LABEL_KEYS.elite)}</Text>
        </View>
      </View>
      {wording.kind === 'range' ? (
        <Text className="text-sm text-text-secondary">{t('strengthLevels.otherNote')}</Text>
      ) : null}
      <StatStrip
        size="lg"
        items={stats}
        palette={{
          background: theme.colors.background.primary,
          border: theme.colors.border.light,
          label: theme.colors.text.secondary,
          unit: theme.colors.text.secondary,
        }}
      />
    </View>
  );
}

/**
 * The attribution that goes wherever a level is shown. It opens on request: three lines of small
 * print under every level pushed the lifts themselves apart.
 */
export function StrengthHowItWorks() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TextButton
        label={t('strengthLevels.howItWorks')}
        tone="muted"
        onPress={() => setOpen((value) => !value)}
      />
      {open ? (
        <View>
          <Text className="text-base text-text-secondary">{t('strengthLevels.sourceNote')}</Text>
          <TextButton
            label={t('strengthLevels.sourceLink')}
            onPress={() => {
              Linking.openURL(OPENPOWERLIFTING_URL).catch(() => {});
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
