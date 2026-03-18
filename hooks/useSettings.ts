import { useMemo } from 'react';

import { useSettingsContext } from '../components/SettingsContext';
import type { UseSettingsResult } from '../constants/settings';
import { getHeightUnit, getWeightUnit } from '../utils/units';

export function useSettings(): UseSettingsResult & {
  theme: any;
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
  notifications: boolean;
  notificationsWorkoutReminders: boolean;
  notificationsActiveWorkout: boolean;
  notificationsNutritionOverview: boolean;
  notificationsMenstrualCycle: boolean;
  notificationsRestTimer: boolean;
  notificationsWorkoutDuration: boolean;
  useOcrBeforeAi: boolean;
  sendFoundationFoodsToLlm: boolean;
  isAiFeaturesEnabled: boolean;
  isSignedInWithGoogle: boolean;
  navSlot1: any;
  navSlot2: any;
  navSlot3: any;
  conversationContext: 'general' | 'exercise' | 'nutrition';
  chartTooltipPosition: any;
  language: string;
} {
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
