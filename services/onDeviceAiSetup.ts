/**
 * Turning on-device AI on or off from onboarding and Settings: the one place that writes the
 * choice and starts the download, so both screens do the same thing.
 */
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { refreshOnDeviceStatus } from '@/services/localModels/onDeviceStatusStore';
import { startLocalModelDownload } from '@/services/localModels/modelStore';
import type { LocalModelSelection } from '@/utils/localModels/install';
import type { OnDeviceEngineChoice } from '@/utils/onDeviceEngine';

/**
 * Switches on-device AI on with `engine`. With `download`, the model download starts in the
 * background (it keeps going after the screen closes and its progress is shown wherever the model
 * card is). Other providers are left as they are: `AiService` keeps its priority order.
 */
export async function enableOnDeviceAi(
  engine: Exclude<OnDeviceEngineChoice, 'auto'>,
  options: { download?: LocalModelSelection } = {}
): Promise<void> {
  await SettingsService.setUseOnDeviceAi(true);
  await SettingsService.set(SETTINGS.onDeviceEngine, engine);
  if (options.download) {
    void startLocalModelDownload(options.download);
  }

  await refreshOnDeviceStatus();
}

export async function disableOnDeviceAi(): Promise<void> {
  await SettingsService.setUseOnDeviceAi(false);
  await refreshOnDeviceStatus();
}

/** Changes which engine answers, without switching on-device AI on or off. */
export async function setOnDeviceEngine(
  engine: Exclude<OnDeviceEngineChoice, 'auto'>
): Promise<void> {
  await SettingsService.set(SETTINGS.onDeviceEngine, engine);
  await refreshOnDeviceStatus();
}
