import { Food } from 'database/models';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useFoodPortions } from '../hooks/useFoodPortions';
import { useFormatAppNumber } from '../hooks/useFormatAppNumber';
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
  onFocus?: () => void;
  productServingSize?: number;
  productMeasures?: { name: string; gramWeight: number }[];
};

const STEP_GRAMS = 10;
const STEP_OZ = 0.5;
const COMMON_GRAM_WEIGHTS = [25, 50, 100, 200] as const;

function isFarEnough(candidateGrams: number, existingGrams: number[]): boolean {
  return existingGrams.every((g) => {
    const diff = Math.abs(candidateGrams - g);
    return diff / Math.max(candidateGrams, g) >= 0.2;
  });
}

export function ServingSizeSelector({
  value,
  onChange,
  quickSizes,
  food,
  onFocus,
  productServingSize,
  productMeasures,
}: ServingSizeSelectorProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const { units } = useSettings();

  // value is always in grams (from parent). Display in g or oz based on units.
  const displayValue = gramsToDisplay(value, units);
  const massUnit = getMassUnitLabel(units);
  const stepAmount = units === 'imperial' ? displayToGrams(STEP_OZ, units) : STEP_GRAMS;
  const stepDisplay = units === 'imperial' ? STEP_OZ : STEP_GRAMS;

  const { portions, allGlobalPortions } = useFoodPortions({
    mode: 'all',
    food,
  });

  // Transform database portions to quick sizes format (label in display unit, value stays in grams)
  const databaseQuickSizes = useMemo(() => {
    return portions.map((portion) => {
      const display = gramsToDisplay(portion.gramWeight, units);
      const labelVal = display % 1 === 0 ? display : Math.round(display * 10) / 10;
      const valueLabel =
        labelVal % 1 === 0 ? formatInteger(Math.round(labelVal)) : formatDecimal(labelVal, 1);

      return {
        label: t('portionSizes.portionWithValueUnit', {
          name: portion.name,
          value: valueLabel,
          unit: massUnit === 'g' ? t('common.units.g') : t('common.units.oz'),
        }),
        value: portion.gramWeight,
      };
    });
  }, [portions, units, massUnit, t, formatInteger, formatDecimal]);

  const commonPortionQuickSizes = useMemo(() => {
    return COMMON_GRAM_WEIGHTS.flatMap((gw) => {
      const match = allGlobalPortions.find((p) => p.gramWeight === gw);
      if (!match) {
        return [];
      }

      const display = gramsToDisplay(match.gramWeight, units);
      const labelVal = display % 1 === 0 ? display : Math.round(display * 10) / 10;
      const valueLabel =
        labelVal % 1 === 0 ? formatInteger(Math.round(labelVal)) : formatDecimal(labelVal, 1);

      return [
        {
          label: t('portionSizes.portionWithValueUnit', {
            name: match.name,
            value: valueLabel,
            unit: massUnit === 'g' ? t('common.units.g') : t('common.units.oz'),
          }),
          value: match.gramWeight,
        },
      ];
    });
  }, [allGlobalPortions, units, massUnit, t, formatInteger, formatDecimal]);

  const productServingQuickSize = useMemo(() => {
    if (!productServingSize || productServingSize <= 0) {
      return null;
    }

    const display = gramsToDisplay(productServingSize, units);
    const labelVal = display % 1 === 0 ? display : Math.round(display * 10) / 10;
    const valueLabel =
      labelVal % 1 === 0 ? formatInteger(Math.round(labelVal)) : formatDecimal(labelVal, 1);

    return {
      label: t('portionSizes.portionWithValueUnit', {
        name: t('food.foodDetails.serving'),
        value: valueLabel,
        unit: massUnit === 'g' ? t('common.units.g') : t('common.units.oz'),
      }),
      value: productServingSize,
    };
  }, [productServingSize, units, massUnit, t, formatInteger, formatDecimal]);

  const productMeasureQuickSizes = useMemo(() => {
    if (!productMeasures || productMeasures.length === 0) {
      return [];
    }

    return productMeasures
      .filter((m) => m.gramWeight > 0)
      .map((m) => {
        const display = gramsToDisplay(m.gramWeight, units);
        const labelVal = display % 1 === 0 ? display : Math.round(display * 10) / 10;
        const valueLabel =
          labelVal % 1 === 0 ? formatInteger(Math.round(labelVal)) : formatDecimal(labelVal, 1);

        return {
          label: t('portionSizes.portionWithValueUnit', {
            name: m.name,
            value: valueLabel,
            unit: massUnit === 'g' ? t('common.units.g') : t('common.units.oz'),
          }),
          value: m.gramWeight,
        };
      });
  }, [productMeasures, units, massUnit, t, formatInteger, formatDecimal]);

  const effectiveQuickSizes = useMemo(() => {
    // Explicit quickSizes prop always wins (meal mode, scale mode, etc.)
    if (quickSizes) {
      return quickSizes;
    }

    // Collect API portions (from OFF serving_size and USDA foodMeasures/foodPortions)
    const apiPortions: { label: string; value: number }[] = [];
    if (productServingQuickSize) {
      apiPortions.push(productServingQuickSize);
    }
    for (const m of productMeasureQuickSizes) {
      if (!apiPortions.some((s) => s.value === m.value)) {
        apiPortions.push(m);
      }
    }

    // Food-specific DB portions (only present when food prop is passed with specific portions)
    const foodDbPortions = databaseQuickSizes;

    // All already-shown items, used for dedup and ≥20% proximity check
    const alreadyShown = [...apiPortions, ...foodDbPortions].filter(
      (p, i, arr) => arr.findIndex((q) => q.value === p.value) === i
    );

    const apiCount = apiPortions.length;
    let supplement: { label: string; value: number }[] = [];

    if (apiCount === 0) {
      // Rule 1: no API data → show all 4 common fallbacks
      supplement = commonPortionQuickSizes.filter(
        (c) => !alreadyShown.some((s) => s.value === c.value)
      );
    } else if (apiCount <= 2) {
      // Rule 2: add up to 2 common portions ≥20% different from all already-shown
      const existingGrams = alreadyShown.map((p) => p.value);
      const picked: { label: string; value: number }[] = [];
      while (picked.length < 2) {
        const combined = [...existingGrams, ...picked.map((p) => p.value)];
        const candidates = commonPortionQuickSizes.filter(
          (c) =>
            !alreadyShown.some((s) => s.value === c.value) &&
            !picked.some((s) => s.value === c.value) &&
            isFarEnough(c.value, combined)
        );
        if (candidates.length === 0) {
          break;
        }
        // Prefer the candidate closest to any already-shown gram weight
        candidates.sort((a, b) => {
          const dA = Math.min(...existingGrams.map((g) => Math.abs(a.value - g)));
          const dB = Math.min(...existingGrams.map((g) => Math.abs(b.value - g)));
          return dA - dB;
        });
        picked.push(candidates[0]);
      }
      supplement = picked;
    } else if (apiCount === 3) {
      // Rule 3: add 100g only if no API portion is already 100g
      if (!apiPortions.some((p) => p.value === 100)) {
        const entry = commonPortionQuickSizes.find((p) => p.value === 100);
        if (entry && !alreadyShown.some((s) => s.value === 100)) {
          supplement = [entry];
        }
      }
    }
    // Rule 4 (apiCount >= 4): no supplement

    // Build final list: API first, then food-specific DB, then common supplement (deduped)
    const result: { label: string; value: number }[] = [...apiPortions];
    for (const p of foodDbPortions) {
      if (!result.some((r) => r.value === p.value)) {
        result.push(p);
      }
    }
    for (const p of supplement) {
      if (!result.some((r) => r.value === p.value)) {
        result.push(p);
      }
    }
    return result;
  }, [
    quickSizes,
    databaseQuickSizes,
    productServingQuickSize,
    productMeasureQuickSizes,
    commonPortionQuickSizes,
  ]);

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
          onFocus={onFocus}
          unit={massUnit}
          variant="portion"
        />
        {quickSizeTabs.length > 0 ? (
          <FilterTabs
            tabs={quickSizeTabs}
            activeTab={String(value)}
            onTabChange={(id) => onChange(Number(id))}
            showContainer={false}
            inactiveBackgroundColor={theme.colors.background.secondaryDark}
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
