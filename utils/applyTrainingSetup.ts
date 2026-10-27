import i18n from 'i18next';

import { SETTINGS } from '@/constants/settingDefinitions';
import { GymService } from '@/database/services/GymService';
import { SettingsService } from '@/database/services/SettingsService';
import { localDayStartMs } from '@/utils/calendarDate';
import { MAX_COMEBACK_DAYS_PER_WEEK } from '@/utils/comeback/comebackState';
import { startedState } from '@/utils/comeback/comebackTransitions';
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
  if (data.comingBack) {
    await startOnboardingComeback(data);
  }
}

/**
 * Starts comeback mode for someone who said, during onboarding, that they are coming back. There is
 * no history to ease from, so `baseBefore` stays null and no load is scaled; the ramp still caps
 * sets and reps in reserve. A comeback that is already running is left alone, so finishing the flow
 * twice does not restart week 1.
 */
async function startOnboardingComeback(data: TrainingSetupData): Promise<void> {
  const breakLength = data.comingBack?.breakLength;
  const today = localDayStartMs(new Date());
  await SettingsService.updateComebackState((current) =>
    current.status === 'active'
      ? current
      : {
          ...startedState(current, {
            track: 'both',
            answers: {
              breakLength,
              location: data.location,
              daysPerWeek: Math.min(MAX_COMEBACK_DAYS_PER_WEEK, data.daysPerWeek),
            },
            today,
          }),
          baseBefore: null,
        }
  );
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
