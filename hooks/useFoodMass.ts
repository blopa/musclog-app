import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { formatDisplayGrams } from '@/utils/formatDisplayWeight';
import { displayToGrams, gramsToDisplay } from '@/utils/unitConversion';
import { getMassUnitI18nKey } from '@/utils/units';

/**
 * The one way UI shows or accepts the mass of a food. Pass it grams (what every service stores) and
 * it answers in the person's unit. Never hardcode "g" or "oz" for a food's weight (macros are in
 * grams in both systems and are not food mass).
 */
export function useFoodMass() {
  const { t } = useTranslation();
  const { locale } = useFormatAppNumber();
  const { units } = useSettings();
  const unitLabel = t(getMassUnitI18nKey(units));
  // Ounces take one decimal, grams none.
  const fractionDigits = units === 'imperial' ? 1 : 0;

  /** "3.5 oz" — amount and unit. */
  const formatMass = useCallback(
    (grams: number) => `${formatDisplayGrams(locale, units, grams)} ${unitLabel}`,
    [locale, units, unitLabel]
  );
  const toDisplay = useCallback((grams: number) => gramsToDisplay(grams, units), [units]);
  const fromDisplay = useCallback((value: number) => displayToGrams(value, units), [units]);
  /** What one press of a stepper adds, in grams: 1 g, or half an ounce. */
  const stepGrams = useCallback(
    (metricStep = 1) => (units === 'imperial' ? displayToGrams(0.5, units) : metricStep),
    [units]
  );
  /**
   * The grams after a typed value: the stored grams are kept when the shown value did not change,
   * so opening and closing a field never drifts a weight by the rounding.
   */
  const gramsAfterEdit = useCallback(
    (grams: number, entered: number) => {
      const factor = 10 ** fractionDigits;
      const shown = Math.round(gramsToDisplay(grams, units) * factor) / factor;

      return entered === shown ? grams : displayToGrams(entered, units);
    },
    [units, fractionDigits]
  );

  return useMemo(
    () => ({
      unitLabel,
      fractionDigits,
      formatMass,
      toDisplay,
      fromDisplay,
      stepGrams,
      gramsAfterEdit,
    }),
    [unitLabel, fractionDigits, formatMass, toDisplay, fromDisplay, stepGrams, gramsAfterEdit]
  );
}
