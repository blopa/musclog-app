import { useMemo } from 'react';

import { type SettingsContextType, useSettingsContext } from '../context/SettingsContext';
import { getHeightUnit, getWeightUnit } from '../utils/units';

export function useSettings(): SettingsContextType {
  const context = useSettingsContext();

  return useMemo(
    () => ({
      ...context,
      weightUnit: getWeightUnit(context.units),
      heightUnit: getHeightUnit(context.units),
    }),
    [context]
  );
}
