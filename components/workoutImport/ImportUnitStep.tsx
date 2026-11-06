import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { LoggyPose } from '@/components/LoggyPose';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';
import type { FirstWeightedSet } from '@/utils/workoutImport/importFlow';
import type { ImportWeightUnit } from '@/utils/workoutImport/types';

type ImportUnitStepProps = {
  unit: ImportWeightUnit;
  onUnitChange: (unit: ImportWeightUnit) => void;
  /** The first weighted set, in kg as it would be stored under the chosen unit. */
  firstSet: FirstWeightedSet | null;
  units: Units;
};

const POSE_HEIGHT = 168;

/** One question, answered against a real number from the file so a wrong unit looks wrong. */
export function ImportUnitStep({ unit, onUnitChange, firstSet, units }: ImportUnitStepProps) {
  const { t } = useTranslation();
  const { formatDecimal, formatInteger } = useFormatAppNumber();

  return (
    <View className="gap-6 px-4 py-4">
      <View className="gap-2">
        <Text className="text-2xl font-bold text-text-primary">
          {t('workoutImport.unit.title')}
        </Text>
        <Text className="text-base text-text-secondary">{t('workoutImport.unit.message')}</Text>
      </View>

      <SegmentedControl
        value={unit}
        onValueChange={(value) => onUnitChange(value as ImportWeightUnit)}
        options={[
          { label: t('workoutImport.unit.kg'), value: 'kg' },
          { label: t('workoutImport.unit.lb'), value: 'lbs' },
        ]}
      />

      {firstSet !== null ? (
        <View className="flex-row items-end overflow-hidden rounded-card border border-border-light bg-bg-card">
          <View className="min-w-0 flex-1 gap-1 p-4">
            <Text className="text-base font-medium text-text-secondary">
              {t('workoutImport.unit.previewTitle')}
            </Text>
            <Text className="text-4xl font-bold tabular-nums text-text-primary">
              {`${formatDecimal(kgToDisplay(firstSet.weightKg, units), 1)} ${t(getWeightUnitI18nKey(units))}`}
            </Text>
            <Text className="text-base text-text-primary" numberOfLines={2}>
              {firstSet.exerciseName}
            </Text>
            {firstSet.reps > 0 ? (
              <Text className="text-base text-text-secondary">
                {t('workoutImport.unit.reps', {
                  count: firstSet.reps,
                  n: formatInteger(firstSet.reps),
                })}
              </Text>
            ) : null}
          </View>
          <LoggyPose pose="thinking" height={POSE_HEIGHT} />
        </View>
      ) : null}
    </View>
  );
}
