import type { AiProviderKind } from '@/constants/ai';
import {
  DEFAULT_COACH_PERSONA_ID,
  EMPTY_CUSTOM_PERSONA,
  resolveCoachPersona,
  type ResolvedCoachPersona,
} from '@/constants/coachPersonas';
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';

/**
 * The persona in effect for a provider, read from the stored settings: the user's pick after every
 * fallback (on-device AI and an unfinished custom persona both resolve to Loggy). Prompts and the
 * welcome rewrite both read it here, so neither depends on what a screen last rendered.
 */
export async function getActiveCoachPersona(
  provider?: AiProviderKind | null
): Promise<ResolvedCoachPersona> {
  try {
    const [id, custom] = await Promise.all([
      SettingsService.get(SETTINGS.coachPersona),
      SettingsService.get(SETTINGS.coachCustomPersona),
    ]);

    return resolveCoachPersona({ id, custom, provider });
  } catch (error) {
    console.error('[coachPersona] Error resolving coach persona:', error);

    return resolveCoachPersona({
      id: DEFAULT_COACH_PERSONA_ID,
      custom: EMPTY_CUSTOM_PERSONA,
      provider,
    });
  }
}
