import { Q } from '@nozbe/watermelondb';
import { useEffect, useMemo, useState } from 'react';

import type { ThemeOption, Units, UseSettingsResult } from '../constants/settings';
import {
  ANONYMOUS_BUG_REPORT_SETTING_TYPE,
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  DAILY_NUTRITION_INSIGHTS_SETTING_TYPE,
  ENABLE_GOOGLE_GEMINI_SETTING_TYPE,
  ENABLE_OPENAI_SETTING_TYPE,
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  GOOGLE_GEMINI_MODEL_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
  OPENAI_MODEL_SETTING_TYPE,
  READ_HEALTH_DATA_SETTING_TYPE,
  THEME_SETTING_TYPE,
  UNITS_SETTING_TYPE,
  WORKOUT_INSIGHTS_SETTING_TYPE,
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
  // If multiple settings exist, use the most recent one
  const mostRecent = settings.reduce((latest, current) =>
    current.updatedAt > latest.updatedAt ? current : latest
  );
  return mostRecent.value === 'true';
}

function parseStringFromSettings(settings: Setting[]): string {
  if (settings.length === 0) return '';
  // If multiple settings exist, use the most recent one
  const mostRecent = settings.reduce((latest, current) =>
    current.updatedAt > latest.updatedAt ? current : latest
  );
  return mostRecent.value;
}

export function useSettings(): UseSettingsResult & {
  theme: ThemeOption;
  connectHealthData: boolean;
  readHealthData: boolean;
  writeHealthData: boolean;
  anonymousBugReport: boolean;
  googleGeminiApiKey: string;
  googleGeminiModel: string;
  openAiApiKey: string;
  openAiModel: string;
  enableGoogleGemini: boolean;
  enableOpenAi: boolean;
  dailyNutritionInsights: boolean;
  workoutInsights: boolean;
} {
  const [units, setUnits] = useState<Units>('metric');
  const [theme, setTheme] = useState<ThemeOption>('system');
  const [connectHealthData, setConnectHealthData] = useState(false);
  const [readHealthData, setReadHealthData] = useState(false);
  const [writeHealthData, setWriteHealthData] = useState(false);
  const [anonymousBugReport, setAnonymousBugReport] = useState(true);
  const [googleGeminiApiKey, setGoogleGeminiApiKey] = useState('');
  const [googleGeminiModel, setGoogleGeminiModel] = useState('gemini-2.0-flash');
  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [openAiModel, setOpenAiModel] = useState('gpt-4o');
  const [enableGoogleGemini, setEnableGoogleGemini] = useState(true);
  const [enableOpenAi, setEnableOpenAi] = useState(true);
  const [dailyNutritionInsights, setDailyNutritionInsights] = useState(true);
  const [workoutInsights, setWorkoutInsights] = useState(false);
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

    const googleGeminiApiKeyQuery = database
      .get<Setting>('settings')
      .query(
        Q.where('type', GOOGLE_GEMINI_API_KEY_SETTING_TYPE),
        Q.where('deleted_at', Q.eq(null))
      );

    const googleGeminiModelQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', GOOGLE_GEMINI_MODEL_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const openAiApiKeyQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', OPENAI_API_KEY_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const openAiModelQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', OPENAI_MODEL_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const enableGoogleGeminiQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', ENABLE_GOOGLE_GEMINI_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const enableOpenAiQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', ENABLE_OPENAI_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const dailyNutritionInsightsQuery = database
      .get<Setting>('settings')
      .query(
        Q.where('type', DAILY_NUTRITION_INSIGHTS_SETTING_TYPE),
        Q.where('deleted_at', Q.eq(null))
      );

    const workoutInsightsQuery = database
      .get<Setting>('settings')
      .query(Q.where('type', WORKOUT_INSIGHTS_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

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

    const connectHealthDataSubscription = connectHealthDataQuery
      .observeWithColumns(['value'])
      .subscribe({
        next: (settings) => {
          console.log(
            '[useSettings] connectHealthData observable fired, settings:',
            settings.length,
            settings.map((s) => ({ type: s.type, value: s.value }))
          );
          const parsedValue = parseBooleanFromSettings(settings);
          console.log('[useSettings] Setting connectHealthData to:', parsedValue);
          setConnectHealthData(parsedValue);
        },
        error: (err) => {
          console.error('[useSettings] Error in connectHealthData observable:', err);
          setConnectHealthData(false);
        },
      });

    const readHealthDataSubscription = readHealthDataQuery.observeWithColumns(['value']).subscribe({
      next: (settings) => {
        setReadHealthData(parseBooleanFromSettings(settings));
      },
      error: () => {
        setReadHealthData(false);
      },
    });

    const writeHealthDataSubscription = writeHealthDataQuery
      .observeWithColumns(['value'])
      .subscribe({
        next: (settings) => {
          setWriteHealthData(parseBooleanFromSettings(settings));
        },
        error: () => {
          setWriteHealthData(false);
        },
      });

    const anonymousBugReportSubscription = anonymousBugReportQuery
      .observeWithColumns(['value'])
      .subscribe({
        next: (settings) => {
          setAnonymousBugReport(parseBooleanFromSettings(settings));
        },
        error: () => {
          setAnonymousBugReport(true);
        },
      });

    const googleGeminiApiKeySubscription = googleGeminiApiKeyQuery.observe().subscribe({
      next: (settings) => {
        setGoogleGeminiApiKey(parseStringFromSettings(settings));
      },
      error: () => {
        setGoogleGeminiApiKey('');
      },
    });

    const googleGeminiModelSubscription = googleGeminiModelQuery.observe().subscribe({
      next: (settings) => {
        setGoogleGeminiModel(parseStringFromSettings(settings));
      },
      error: () => {
        setGoogleGeminiModel('gemini-2.0-flash');
      },
    });

    const openAiApiKeySubscription = openAiApiKeyQuery.observe().subscribe({
      next: (settings) => {
        setOpenAiApiKey(parseStringFromSettings(settings));
      },
      error: () => {
        setOpenAiApiKey('');
      },
    });

    const openAiModelSubscription = openAiModelQuery.observe().subscribe({
      next: (settings) => {
        setOpenAiModel(parseStringFromSettings(settings));
      },
      error: () => {
        setOpenAiModel('gpt-4o');
      },
    });

    const enableGoogleGeminiSubscription = enableGoogleGeminiQuery
      .observeWithColumns(['value'])
      .subscribe({
        next: (settings) => {
          console.log(
            '[useSettings] enableGoogleGemini observable fired, settings:',
            settings.length,
            settings.map((s) => ({ type: s.type, value: s.value }))
          );
          const parsedValue = parseBooleanFromSettings(settings);
          console.log('[useSettings] Setting enableGoogleGemini to:', parsedValue);
          setEnableGoogleGemini(parsedValue);
        },
        error: (err) => {
          console.error('[useSettings] Error in enableGoogleGemini observable:', err);
          setEnableGoogleGemini(true);
        },
      });

    const enableOpenAiSubscription = enableOpenAiQuery.observeWithColumns(['value']).subscribe({
      next: (settings) => {
        console.log(
          '[useSettings] enableOpenAi observable fired, settings:',
          settings.length,
          settings.map((s) => ({ type: s.type, value: s.value }))
        );
        const parsedValue = parseBooleanFromSettings(settings);
        console.log('[useSettings] Setting enableOpenAi to:', parsedValue);
        setEnableOpenAi(parsedValue);
      },
      error: (err) => {
        console.error('[useSettings] Error in enableOpenAi observable:', err);
        setEnableOpenAi(true);
      },
    });

    const dailyNutritionInsightsSubscription = dailyNutritionInsightsQuery
      .observeWithColumns(['value'])
      .subscribe({
        next: (settings) => {
          console.log(
            '[useSettings] dailyNutritionInsights observable fired, settings:',
            settings.length,
            settings.map((s) => ({ type: s.type, value: s.value }))
          );
          const parsedValue = parseBooleanFromSettings(settings);
          console.log('[useSettings] Setting dailyNutritionInsights to:', parsedValue);
          setDailyNutritionInsights(parsedValue);
        },
        error: (err) => {
          console.error('[useSettings] Error in dailyNutritionInsights observable:', err);
          setDailyNutritionInsights(true);
        },
      });

    const workoutInsightsSubscription = workoutInsightsQuery
      .observeWithColumns(['value'])
      .subscribe({
        next: (settings) => {
          console.log(
            '[useSettings] workoutInsights observable fired, settings:',
            settings.length,
            settings.map((s) => ({ type: s.type, value: s.value }))
          );
          const parsedValue = parseBooleanFromSettings(settings);
          console.log('[useSettings] Setting workoutInsights to:', parsedValue);
          setWorkoutInsights(parsedValue);
        },
        error: (err) => {
          console.error('[useSettings] Error in workoutInsights observable:', err);
          setWorkoutInsights(false);
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
      googleGeminiApiKeySubscription.unsubscribe();
      googleGeminiModelSubscription.unsubscribe();
      openAiApiKeySubscription.unsubscribe();
      openAiModelSubscription.unsubscribe();
      enableGoogleGeminiSubscription.unsubscribe();
      enableOpenAiSubscription.unsubscribe();
      dailyNutritionInsightsSubscription.unsubscribe();
      workoutInsightsSubscription.unsubscribe();
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
      googleGeminiApiKey,
      googleGeminiModel,
      openAiApiKey,
      openAiModel,
      enableGoogleGemini,
      enableOpenAi,
      dailyNutritionInsights,
      workoutInsights,
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
      googleGeminiApiKey,
      googleGeminiModel,
      openAiApiKey,
      openAiModel,
      enableGoogleGemini,
      enableOpenAi,
      dailyNutritionInsights,
      workoutInsights,
      isLoading,
    ]
  );
}
