import i18n from 'i18next';

import { SETTINGS } from '@/constants/settingDefinitions';
import { GymService } from '@/database/services/GymService';
import { SettingsService } from '@/database/services/SettingsService';
import { defaultBarWeightKg, defaultPlates, defaultWeightIncrementKg } from '@/utils/gym';
import {
  equipmentForLocation,
  type TrainingLocation,
  type TrainingSetupData,
} from '@/utils/onboardingTraining';

/**
 * Turns the onboarding training answers into real settings: the load-suggestion preference and a
 * first gym profile (made active). Safe to run twice — a profile is only created when the user has
 * none, so backing out of the flow and finishing it again does not stack gyms.
 */
export async function applyTrainingSetup(data: TrainingSetupData): Promise<void> {
  await SettingsService.set(SETTINGS.workoutAutonomy, data.autonomy);
  await ensureGymForLocation(data.location);
}

/**
 * Makes sure the user has a gym profile, creating the one a place to train implies (and making it
 * active) only when they have none. Returns whether it created one. Shared by onboarding and a
 * comeback's setup, so neither can stack a second profile on top of an existing one.
 */
export async function ensureGymForLocation(location: TrainingLocation): Promise<boolean> {
  if ((await GymService.getGyms()).length > 0) {
    return false;
  }

  const units = await SettingsService.getUnits();
  await GymService.createGym(
    {
      name: i18n.t(`onboarding.trainingSetup.gymNames.${location}`),
      barWeightKg: location === 'minimal' ? 0 : defaultBarWeightKg(units),
      plates: location === 'minimal' ? [] : defaultPlates(units),
      weightIncrementKg: defaultWeightIncrementKg(units),
      equipment: equipmentForLocation(location),
      weightUnit: null,
    },
    { makeActive: true }
  );

  return true;
}
