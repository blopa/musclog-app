import { Q } from '@nozbe/watermelondb';
import { useEffect, useMemo, useState } from 'react';

import type { Units, UseSettingsResult } from '../constants/settings';
import { UNITS_SETTING_TYPE } from '../constants/settings';
import { database } from '../database';
import Setting from '../database/models/Setting';
import { getHeightUnit, getWeightUnit } from '../utils/units';

function parseUnitsFromSettings(settings: Setting[]): Units {
  if (settings.length === 0) return 'metric';
  const value = settings[0].value;
  return value === '1' ? 'imperial' : 'metric';
}

export function useSettings(): UseSettingsResult {
  const [units, setUnits] = useState<Units>('metric');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const query = database
      .get<Setting>('settings')
      .query(Q.where('type', UNITS_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const subscription = query.observe().subscribe({
      next: (settings) => {
        setUnits(parseUnitsFromSettings(settings));
        setIsLoading(false);
      },
      error: () => {
        setUnits('metric');
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      units,
      isLoading,
      weightUnit: getWeightUnit(units),
      heightUnit: getHeightUnit(units),
    }),
    [units, isLoading]
  );
}
