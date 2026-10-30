import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImageSourcePropType } from 'react-native';

import { coachAvatarSource } from '@/components/coach/coachPersonaAvatars';
import {
  coachDisplayName,
  type CoachPersonaId,
  type CustomCoachPersona,
  providerSupportsPersona,
  resolveCoachPersona,
} from '@/constants/coachPersonas';
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';

export type CoachPersonaContextType = {
  /** The persona in effect, after the on-device and unfinished-custom fallbacks. */
  id: CoachPersonaId;
  /** The name to show: translated for a preset, the user's own for a custom persona. */
  name: string;
  avatarSource: ImageSourcePropType;
  /** The user's saved pick, which can differ from `id` while a fallback applies. */
  selectedId: CoachPersonaId;
  /** The saved custom persona, for the editor. */
  custom: CustomCoachPersona;
  /** False on on-device AI, where Loggy is always used. */
  canChoose: boolean;
};

const CoachPersonaContext = createContext<CoachPersonaContextType | null>(null);

/**
 * Who the coach is, for everything the user sees: the header, chat avatars, the shared transcript.
 * It is the ONE owner of the custom persona's subscription, because that persona is observed from
 * its own settings row rather than read from `SettingsState` (its avatar makes it too large for
 * that) and every chat bubble and carousel needs it — a hook that subscribed per call site opened
 * one observer for each of them.
 */
export function CoachPersonaProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { coachPersona, aiProvider } = useSettings();
  const [custom, setCustom] = useState<CustomCoachPersona>(
    SETTINGS.coachCustomPersona.defaultValue
  );

  useEffect(() => {
    const subscription = SettingsService.observe(SETTINGS.coachCustomPersona).subscribe({
      next: setCustom,
      error: (error: Error) => console.error('Error observing custom coach persona:', error),
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<CoachPersonaContextType>(() => {
    const resolved = resolveCoachPersona({ id: coachPersona, custom, provider: aiProvider });

    return {
      id: resolved.id,
      name: coachDisplayName(resolved, t),
      avatarSource: coachAvatarSource(resolved.id, resolved.avatar),
      selectedId: coachPersona,
      custom,
      canChoose: providerSupportsPersona(aiProvider),
    };
  }, [coachPersona, custom, aiProvider, t]);

  return <CoachPersonaContext.Provider value={value}>{children}</CoachPersonaContext.Provider>;
}

export function useCoachPersona(): CoachPersonaContextType {
  const context = useContext(CoachPersonaContext);
  if (!context) {
    throw new Error('useCoachPersona must be used within a CoachPersonaProvider');
  }

  return context;
}
