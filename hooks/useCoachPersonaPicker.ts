import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { CoachPersonaId, CustomCoachPersona } from '@/constants/coachPersonas';
import { SETTINGS } from '@/constants/settingDefinitions';
import { useCoachPersona } from '@/context/CoachPersonaContext';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';
import { applyPersonaWelcome } from '@/services/coachPersonaWelcome';
import { dataUriFromBase64 } from '@/utils/coachPersonaAvatar';
import { createThumbnail } from '@/utils/file';
import { pickAndCropImageFromGallery } from '@/utils/galleryImagePicker';
import { handleError } from '@/utils/handleError';

/** Side of the stored avatar. Small on purpose: it lives inside a settings row, as a data URI. */
const AVATAR_SIZE_PX = 256;

/**
 * The write side of the coach persona, shared by Settings and the onboarding step so the two cannot
 * drift. Picking a persona saves it and then greets the user as that coach: the seeded welcome of
 * every untouched conversation is rewritten, real history never is. The greeting reads the coach
 * back from the settings that were just written, never from what this hook last rendered.
 */
export function useCoachPersonaPicker() {
  const { t } = useTranslation();
  const { aiProvider } = useSettings();
  const persona = useCoachPersona();

  /**
   * Runs a persona write and then greets the user as the coach it left stored. Both persona
   * writes share this, so neither can forget the greeting or report its failure differently.
   */
  const writeAndGreet = useCallback(
    async (context: string, write: () => Promise<unknown>): Promise<boolean> => {
      try {
        await write();
        await applyPersonaWelcome(aiProvider);

        return true;
      } catch (error) {
        handleError(error, `useCoachPersonaPicker.${context}`, {
          snackbarMessage: t('errors.somethingWentWrong'),
        });

        return false;
      }
    },
    [aiProvider, t]
  );

  const selectPersona = useCallback(
    (id: CoachPersonaId) =>
      writeAndGreet('selectPersona', () => SettingsService.set(SETTINGS.coachPersona, id)),
    [writeAndGreet]
  );

  /** Saves the custom persona and makes it the coach: a freshly written coach is the one wanted. */
  const saveCustomPersona = useCallback(
    (patch: Partial<CustomCoachPersona>) =>
      writeAndGreet('saveCustomPersona', async () => {
        await SettingsService.updateCoachCustomPersona(patch);
        await SettingsService.set(SETTINGS.coachPersona, 'custom');
      }),
    [writeAndGreet]
  );

  /** Picks, crops and shrinks an avatar; resolves the data URI, or null when cancelled or failed. */
  const pickAvatar = useCallback(async (): Promise<string | null> => {
    try {
      const croppedPath = await pickAndCropImageFromGallery();
      if (!croppedPath) {
        return null;
      }

      const thumbnail = await createThumbnail(croppedPath, AVATAR_SIZE_PX);

      return thumbnail.base64 ? dataUriFromBase64(thumbnail.base64) : null;
    } catch (error) {
      handleError(error, 'useCoachPersonaPicker.pickAvatar', {
        snackbarMessage: t('coach.personaPicker.custom.errorImage'),
      });

      return null;
    }
  }, [t]);

  return { persona, selectPersona, saveCustomPersona, pickAvatar };
}
