// Who may use the cloud AI Musclog runs.

import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { UserService } from '@/database/services/UserService';
import { isUnderCloudAiAge } from '@/utils/ageGate';

/** True when the stored birthday says this person is too young for Musclog's cloud AI. */
export async function isCloudAiBlockedForAge(): Promise<boolean> {
  const user = await UserService.getCurrentUser();

  return isUnderCloudAiAge(user?.dateOfBirth);
}

/**
 * Switches the free tier and Musclog Iron off for someone under 18, whichever way they came to be
 * on (an older version, a restored backup, a birthday corrected later). Run at boot.
 */
export async function enforceCloudAiAge(): Promise<void> {
  if (!(await isCloudAiBlockedForAge())) {
    return;
  }

  if (await SettingsService.getUseMusclogFreeTier()) {
    await SettingsService.setUseMusclogFreeTier(false);
  }

  if (await SettingsService.get(SETTINGS.useHostedAi)) {
    await SettingsService.set(SETTINGS.useHostedAi, false);
  }
}
