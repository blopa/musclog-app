import type { CoachAIProvider } from '@/utils/coachAI';

/** Whole translation keys, one per provider, so the compiler asks for a name when one is added. */
export const PROVIDER_NAME_KEYS: Record<CoachAIProvider, string> = {
  gemini: 'aiOnboarding.provider.names.gemini',
  openai: 'aiOnboarding.provider.names.openai',
  gateway: 'aiOnboarding.provider.names.gateway',
  'on-device': 'aiOnboarding.provider.names.onDevice',
  local: 'aiOnboarding.provider.names.local',
};
