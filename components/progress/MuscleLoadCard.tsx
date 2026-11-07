import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import BodyHighlighter from '@/components/BodyHighlighter';
import { BottomPopUp } from '@/components/BottomPopUp';
import { GenericCard } from '@/components/cards/GenericCard';
import { MUSCLE_LABEL_KEYS } from '@/components/progress/muscleLoadCopy';
import type { MuscleLoadSetDetail } from '@/database/repositories/MuscleLoadRepository';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { MuscleSlug } from '@/utils/muscleGroupMapping';
import {
  countedSetsForSlug,
  type MuscleLoadEntry,
  muscleLoadSlugIntensity,
} from '@/utils/muscleLoad';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnit } from '@/utils/units';

/** Two figures side by side have to fit a padded card on a 390-wide phone. */
const BODY_MAP_SCALE = 0.72;

interface MuscleLoadCardProps {
  load: ReadonlyMap<MuscleSlug, MuscleLoadEntry>;
  sets: MuscleLoadSetDetail[];
  isLoading: boolean;
}

/**
 * What was trained in the last week, drawn on the body map. Load, never readiness: the copy says
 * what was done, and nothing here rates a muscle.
 */
export function MuscleLoadCard({ load, sets, isLoading }: MuscleLoadCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dateFnsLocale = useDateFnsLocale();
  const { formatDecimal } = useFormatAppNumber();
  const { unitsFor } = useExerciseUserSettings();
  // The time of the tap is kept with the muscle, so the list is read from state, not during render.
  const [selection, setSelection] = useState<{ slug: MuscleSlug; now: number } | null>(null);
  const selected = selection?.slug ?? null;

  const intensities = useMemo(() => muscleLoadSlugIntensity(load), [load]);

  if (isLoading) {
    return null;
  }

  const shadeColors = [
    theme.colors.accent.primary + '55',
    theme.colors.accent.primary + '99',
    theme.colors.accent.primary,
  ];
  const legend = [
    { color: shadeColors[0], label: t('muscleLoad.load.legendLight') },
    { color: shadeColors[1], label: t('muscleLoad.load.legendModerate') },
    { color: shadeColors[2], label: t('muscleLoad.load.legendHigh') },
  ];

  const detailSets = selection ? countedSetsForSlug(sets, selection.slug, selection.now) : [];

  return (
    <GenericCard variant="flat">
      <View style={{ padding: 16 }}>
        <View className="mb-4">
          <Text className="text-lg font-semibold text-text-primary">
            {t('muscleLoad.load.title')}
          </Text>
          <Text className="text-xs text-text-tertiary">{t('muscleLoad.load.subtitle')}</Text>
        </View>

        {intensities.size === 0 ? (
          <Text className="py-6 text-center text-sm text-text-secondary">
            {t('muscleLoad.load.empty')}
          </Text>
        ) : (
          <>
            <BodyHighlighter
              slugIntensities={intensities}
              scale={BODY_MAP_SCALE}
              onMusclePress={(slug) => setSelection({ slug, now: Date.now() })}
            />
            <View className="mt-2 flex-row flex-wrap justify-center gap-x-5 gap-y-2">
              {legend.map((item) => (
                <View key={item.label} className="flex-row items-center gap-2">
                  <View className="h-3 w-3 rounded-tag" style={{ backgroundColor: item.color }} />
                  <Text className="text-xs text-text-secondary">{item.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text className="mt-4 text-xs text-text-tertiary">{t('muscleLoad.load.footnote')}</Text>
      </View>

      <BottomPopUp
        visible={selected !== null}
        onClose={() => setSelection(null)}
        title={selected ? t(MUSCLE_LABEL_KEYS[selected]) : ''}
        subtitle={t('muscleLoad.load.sheetSubtitle')}
      >
        <View className="gap-3 p-6">
          <Text className="text-sm font-semibold text-text-secondary">
            {t('muscleLoad.load.sheetSetCount', { count: detailSets.length })}
          </Text>
          {detailSets.map((set, index) => {
            const units = unitsFor(set.exerciseId);
            const unitLabel = getWeightUnit(units);
            const weight = formatDecimal(kgToDisplay(set.weightKg, units), 1);

            return (
              <View
                key={`${set.sessionId}:${set.exerciseId}:${index}`}
                className="flex-row items-center justify-between gap-3 border-b border-border-light py-2"
              >
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-primary">
                    {set.exerciseName}
                  </Text>
                  <Text className="text-xs text-text-tertiary">
                    {format(new Date(set.performedAt), 'PP', { locale: dateFnsLocale })}
                  </Text>
                </View>
                <Text className="text-sm tabular-nums text-text-secondary">
                  {set.weightKg > 0
                    ? t('muscleLoad.load.sheetSetDetail', {
                        count: set.reps,
                        value: weight,
                        unit: unitLabel,
                      })
                    : t('muscleLoad.load.sheetRepsOnly', { count: set.reps })}
                </Text>
              </View>
            );
          })}
        </View>
      </BottomPopUp>
    </GenericCard>
  );
}
