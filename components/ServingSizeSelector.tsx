import { Food } from 'database/models';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useFoodPortions } from '../hooks/useFoodPortions';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { displayToGrams, getMassUnitLabel, gramsToDisplay } from '../utils/unitConversion';
import { GenericCard } from './cards/GenericCard';
import { FilterTabs } from './FilterTabs';
import { StepperInput } from './theme/StepperInput';

type ServingSizeSelectorProps = {
  value: number;
  onChange: (value: number) => void;
  quickSizes?: { label: string; value: number }[];
  food?: Food;
};

const STEP_GRAMS = 10;
const STEP_OZ = 0.5;

export function ServingSizeSelector({
  value,
  onChange,
  quickSizes,
  food,
}: ServingSizeSelectorProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();

  // value is always in grams (from parent). Display in g or oz based on units.
  const displayValue = gramsToDisplay(value, units);
  const massUnit = getMassUnitLabel(units);
  const stepAmount = units === 'imperial' ? displayToGrams(STEP_OZ, units) : STEP_GRAMS;
  const stepDisplay = units === 'imperial' ? STEP_OZ : STEP_GRAMS;

  const { portions } = useFoodPortions({
    mode: 'all',
    food,
  });

  // Transform database portions to quick sizes format (label in display unit, value stays in grams)
  const databaseQuickSizes = useMemo(() => {
    return portions.map((portion) => {
      const display = gramsToDisplay(portion.gramWeight, units);
      const labelVal = display % 1 === 0 ? display : Math.round(display * 10) / 10;

      return {
        label: t('portionSizes.portionWithValueUnit', {
          name: portion.name,
          value: labelVal,
          unit: massUnit === 'g' ? t('common.units.g') : t('common.units.oz'),
        }),
        value: portion.gramWeight,
      };
    });
  }, [portions, units, massUnit, t]);

  const effectiveQuickSizes = quickSizes || databaseQuickSizes;

  const handleDecrease = () => onChange(Math.max(0, value - stepAmount));
  const handleIncrease = () => onChange(value + stepAmount);
  const handleChangeValue = (displayVal: number) => onChange(displayToGrams(displayVal, units));

  const quickSizeTabs = effectiveQuickSizes.map((size) => ({
    id: String(size.value),
    label: size.label,
  }));

  return (
    <GenericCard variant="default">
      <View className="mt-6 w-full gap-3 pl-4 pr-4">
        <StepperInput
          label={t('food.foodDetails.servingSize')}
          value={displayValue}
          step={stepDisplay}
          onIncrement={handleIncrease}
          onDecrement={handleDecrease}
          onChangeValue={handleChangeValue}
          unit={massUnit}
          variant="portion"
        />
        {quickSizeTabs.length > 0 ? (
          <FilterTabs
            tabs={quickSizeTabs}
            activeTab={String(value)}
            onTabChange={(id) => onChange(Number(id))}
            showContainer={false}
            scrollViewContentContainerStyle={{
              paddingHorizontal: theme.spacing.padding.sm,
              paddingVertical: theme.spacing.padding.sm,
            }}
          />
        ) : (
          <View pointerEvents="none" style={{ height: theme.spacing.padding.xs }} />
        )}
      </View>
    </GenericCard>
  );
}
