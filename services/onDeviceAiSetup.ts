/**
 * Turning on-device AI on or off from onboarding and Settings: the one place that writes the
 * choice and starts the download, so both screens do the same thing.
 *
 * Every caller is a tap handler or a `void` call, so these never reject: a failed write is reported
 * here, once, and the call resolves `false` for the screen to undo its optimistic state.
 */
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { startLocalModelDownload } from '@/services/localModels/modelStore';
import { refreshOnDeviceStatus } from '@/services/localModels/onDeviceStatusStore';
import { handleError } from '@/utils/handleError';
import type { LocalModelSelection } from '@/utils/localModels/install';
import type { OnDeviceEngineChoice } from '@/utils/onDeviceEngine';

/** Runs one setup change; true when it was saved, false (and reported) when it was not. */
async function saved(context: string, change: () => Promise<void>): Promise<boolean> {
  try {
    await change();

    return true;
  } catch (error) {
    void handleError(error, context, { showSnackbar: false });

    return false;
  }
}

/**
 * Switches on-device AI on with `engine`. With `download`, the model download starts in the
 * background (it keeps going after the screen closes and its progress is shown wherever the model
 * card is), and only once the choice is saved. Other providers are left as they are: `AiService`
 * keeps its priority order.
 */
export function enableOnDeviceAi(
  engine: Exclude<OnDeviceEngineChoice, 'auto'>,
  options: { download?: LocalModelSelection } = {}
): Promise<boolean> {
  return saved('onDeviceAi.enable', async () => {
    await SettingsService.setUseOnDeviceAi(true);
    await SettingsService.set(SETTINGS.onDeviceEngine, engine);
    if (options.download) {
      void startLocalModelDownload(options.download);
    }

    await refreshOnDeviceStatus();
  });
}

export function disableOnDeviceAi(): Promise<boolean> {
  return saved('onDeviceAi.disable', async () => {
    await SettingsService.setUseOnDeviceAi(false);
    await refreshOnDeviceStatus();
  });
}

/** Changes which engine answers, without switching on-device AI on or off. */
export function setOnDeviceEngine(engine: Exclude<OnDeviceEngineChoice, 'auto'>): Promise<boolean> {
  return saved('onDeviceAi.engine', async () => {
    await SettingsService.set(SETTINGS.onDeviceEngine, engine);
    await refreshOnDeviceStatus();
  });
}
