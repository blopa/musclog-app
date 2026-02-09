import { Q } from '@nozbe/watermelondb';
import { useEffect, useMemo, useState } from 'react';

import type { ThemeOption, Units, UseSettingsResult } from '../constants/settings';
import {
  ANONYMOUS_BUG_REPORT_SETTING_TYPE,
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  READ_HEALTH_DATA_SETTING_TYPE,
  THEME_SETTING_TYPE,
  UNITS_SETTING_TYPE,
  WRITE_HEALTH_DATA_SETTING_TYPE,
} from '../constants/settings';
import { database } from '../database';
import Setting from '../database/models/Setting';
import { getHeightUnit, getWeightUnit } from '../utils/units';

function parseUnitsFromSettings(settings: Setting[]): Units {
  if (settings.length === 0) return 'metric';
  const value = settings[0].value;
  return value === '1' ? 'imperial' : 'metric';
}

function parseThemeFromSettings(settings: Setting[]): ThemeOption {
  if (settings.length === 0) return 'system';
  const value = settings[0].value;
  return value === 'light' || value === 'dark' ? value : 'system';
}

function parseBooleanFromSettings(settings: Setting[]): boolean {
  if (settings.length === 0) return false;
  return settings[0].value === 'true';
}

export function useSettings(): UseSettingsResult & {
  theme: ThemeOption;
  connectHealthData: boolean;
  readHealthData: boolean;
  writeHealthData: boolean;
  anonymousBugReport: boolean;
} {
  const [units, setUnits] = useState<Units>('metric');
  const [theme, setTheme] = useState<ThemeOption>('system');
  const [connectHealthData, setConnectHealthData] = useState(false);
  const [readHealthData, setReadHealthData] = useState(false);
  const [writeHealthData, setWriteHealthData] = useState(false);
  const [anonymousBugReport, setAnonymousBugReport] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unitsQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', UNITS_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const themeQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', THEME_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const connectHealthDataQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', CONNECT_HEALTH_DATA_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const readHealthDataQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', READ_HEALTH_DATA_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const writeHealthDataQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', WRITE_HEALTH_DATA_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const anonymousBugReportQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', ANONYMOUS_BUG_REPORT_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const unitsSubscription = unitsQuery.observe().subscribe({
      next: (settings) => {
        setUnits(parseUnitsFromSettings(settings));
      },
      error: () => {
        setUnits('metric');
      },
    });

    const themeSubscription = themeQuery.observe().subscribe({
      next: (settings) => {
        setTheme(parseThemeFromSettings(settings));
      },
      error: () => {
        setTheme('system');
      },
    });

    const connectHealthDataSubscription = connectHealthDataQuery.observe().subscribe({
      next: (settings) => {
        setConnectHealthData(parseBooleanFromSettings(settings));
      },
      error: () => {
        setConnectHealthData(false);
      },
    });

    const readHealthDataSubscription = readHealthDataQuery.observe().subscribe({
      next: (settings) => {
        setReadHealthData(parseBooleanFromSettings(settings));
      },
      error: () => {
        setReadHealthData(false);
      },
    });

    const writeHealthDataSubscription = writeHealthDataQuery.observe().subscribe({
      next: (settings) => {
        setWriteHealthData(parseBooleanFromSettings(settings));
      },
      error: () => {
        setWriteHealthData(false);
      },
    });

    const anonymousBugReportSubscription = anonymousBugReportQuery.observe().subscribe({
      next: (settings) => {
        setAnonymousBugReport(parseBooleanFromSettings(settings));
      },
      error: () => {
        setAnonymousBugReport(true);
      },
    });

    // Set loading to false once all subscriptions have had a chance to load
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => {
      unitsSubscription.unsubscribe();
      themeSubscription.unsubscribe();
      connectHealthDataSubscription.unsubscribe();
      readHealthDataSubscription.unsubscribe();
      writeHealthDataSubscription.unsubscribe();
      anonymousBugReportSubscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      units,
      theme,
      connectHealthData,
      readHealthData,
      writeHealthData,
      anonymousBugReport,
      isLoading,
      weightUnit: getWeightUnit(units),
      heightUnit: getHeightUnit(units),
    }),
    [
      units,
      theme,
      connectHealthData,
      readHealthData,
      writeHealthData,
      anonymousBugReport,
      isLoading,
    ]
  );
}
