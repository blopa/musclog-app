import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ListRow } from '@/components/theme/ListRow';
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
      <Text className="text-lg font-semibold text-text-primary">
        {t('workoutImport.unit.message')}
      </Text>

      <View className="gap-3" accessibilityRole="radiogroup">
        <ListRow
          variant="card"
          title={t('workoutImport.unit.kg')}
          selected={unit === 'kg'}
          onPress={() => onUnitChange('kg')}
        />
        <ListRow
          variant="card"
          title={t('workoutImport.unit.lb')}
          selected={unit === 'lbs'}
          onPress={() => onUnitChange('lbs')}
        />
      </View>

      {firstWeightKg !== null ? (
        <View className="rounded-card border border-border-light bg-bg-card p-4">
          <Text className="text-base text-text-primary">
            {t('workoutImport.unit.preview', {
              value: formatDecimal(kgToDisplay(firstWeightKg, units), 1),
              unit: t(getWeightUnitI18nKey(units)),
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
