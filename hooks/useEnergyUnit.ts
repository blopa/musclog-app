import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { EnergyUnit } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import {
  displayToEnergyKcal,
  energyKcalAfterEdit,
  energyToDisplay,
  formatEnergyAmount,
} from '@/utils/energyUnit';

/**
 * The one way UI shows or accepts energy. Pass it kilocalories (what every service stores) and it
 * answers in the person's unit. Never hardcode "kcal" in a component.
 */
export function useEnergyUnit() {
  const { t } = useTranslation();
  const { locale } = useFormatAppNumber();
  const { energyUnit } = useSettings();
  const unit: EnergyUnit = energyUnit;

  const unitLabel = t(unit === 'kj' ? 'common.energyUnit.kj' : 'common.energyUnit.kcal');

  const toDisplay = useCallback((kcal: number) => energyToDisplay(kcal, unit), [unit]);
  const fromDisplay = useCallback((value: number) => displayToEnergyKcal(value, unit), [unit]);
  const kcalAfterEdit = useCallback(
    (originalKcal: number, enteredValue: number) =>
      energyKcalAfterEdit(originalKcal, enteredValue, unit),
    [unit]
  );
  /** "2092" — the amount alone, rounded. */
  const formatEnergy = useCallback(
    (kcal: number, options?: Intl.NumberFormatOptions) =>
      formatEnergyAmount(locale, kcal, unit, options),
    [locale, unit]
  );
  /** "2092 kJ" — amount and unit, for strings that used to read "{{n}} kcal". */
  const formatEnergyWithUnit = useCallback(
    (kcal: number, options?: Intl.NumberFormatOptions) =>
      `${formatEnergyAmount(locale, kcal, unit, options)} ${unitLabel}`,
    [locale, unit, unitLabel]
  );

  return useMemo(
    () => ({
      energyUnit: unit,
      unitLabel,
      toDisplay,
      fromDisplay,
      kcalAfterEdit,
      formatEnergy,
      formatEnergyWithUnit,
    }),
    [unit, unitLabel, toDisplay, fromDisplay, kcalAfterEdit, formatEnergy, formatEnergyWithUnit]
  );
}
