import i18n from 'i18next';

import { SETTINGS } from '@/constants/settingDefinitions';
import { GymService } from '@/database/services/GymService';
import { SettingsService } from '@/database/services/SettingsService';
import { defaultBarWeightKg, defaultPlates, defaultWeightIncrementKg } from '@/utils/gym';
import { equipmentForLocation, type TrainingSetupData } from '@/utils/onboardingTraining';

/**
 * Turns the onboarding training answers into real settings: the load-suggestion preference and a
 * first gym profile (made active). Safe to run twice — a profile is only created when the user has
 * none, so backing out of the flow and finishing it again does not stack gyms.
 */
export async function applyTrainingSetup(data: TrainingSetupData): Promise<void> {
  await SettingsService.set(SETTINGS.workoutAutonomy, data.autonomy);

  if ((await GymService.getGyms()).length > 0) {
    return;
  }

  const units = await SettingsService.getUnits();
  await GymService.createGym(
    {
      name: i18n.t(`onboarding.trainingSetup.gymNames.${data.location}`),
      barWeightKg: data.location === 'minimal' ? 0 : defaultBarWeightKg(units),
      plates: data.location === 'minimal' ? [] : defaultPlates(units),
      weightIncrementKg: defaultWeightIncrementKg(units),
      equipment: equipmentForLocation(data.location),
      weightUnit: null,
    },
    { makeActive: true }
  );
}
