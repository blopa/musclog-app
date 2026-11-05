import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { SegmentedControl } from '@/components/theme/SegmentedControl';
import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';
import type { ImportWeightUnit } from '@/utils/workoutImport/types';

type ImportUnitStepProps = {
  unit: ImportWeightUnit;
  onUnitChange: (unit: ImportWeightUnit) => void;
  /** The first weighted set, in kg as it would be stored under the chosen unit. */
  firstWeightKg: number | null;
  units: Units;
};

export function ImportUnitStep({ unit, onUnitChange, firstWeightKg, units }: ImportUnitStepProps) {
  const { t } = useTranslation();
  const { formatDecimal } = useFormatAppNumber();

  return (
    <View className="gap-6 px-4 py-6">
      <Text className="text-base text-text-primary">{t('workoutImport.unit.message')}</Text>
      <SegmentedControl
        fullWidth
        value={unit}
        onValueChange={(value) => onUnitChange(value as ImportWeightUnit)}
        options={[
          { label: t('workoutImport.unit.kg'), value: 'kg' },
          { label: t('workoutImport.unit.lb'), value: 'lbs' },
        ]}
      />
      {firstWeightKg !== null ? (
        <Text className="text-sm text-text-secondary">
          {t('workoutImport.unit.preview', {
            value: formatDecimal(kgToDisplay(firstWeightKg, units), 1),
            unit: t(getWeightUnitI18nKey(units)),
          })}
        </Text>
      ) : null}
    </View>
  );
}
