import type { AiProviderKind } from '@/constants/ai';
import { coachDisplayName } from '@/constants/coachPersonas';
import { COACH_WELCOME_KEYS } from '@/constants/coachWelcome';
import type { ChatMessageContext } from '@/database/models/ChatMessage';
import { ChatService } from '@/database/services/ChatService';
import i18n, { AVAILABLE_LANGUAGES } from '@/lang/lang';
import { getActiveCoachPersona } from '@/services/coachPersona';

const CONTEXTS = Object.keys(COACH_WELCOME_KEYS) as ChatMessageContext[];

/**
 * Greets the user as the coach that is stored right now: the persona is read from the settings,
 * never passed in, so a caller holding a stale render cannot greet as the wrong coach. Rewrites the
 * seeded welcome of every conversation that still holds only that welcome (see
 * `ChatService.rewriteUntouchedWelcomeMessages`). The texts are rendered in the current language; the
 * legacy set is the Loggy welcome in EVERY bundled language, which is how an install seeded before
 * the `welcome` marker existed is still recognised.
 */
export async function applyPersonaWelcome(provider: AiProviderKind | null): Promise<void> {
  const name = coachDisplayName(await getActiveCoachPersona(provider), i18n.t);

  const textsByContext = Object.fromEntries(
    CONTEXTS.map((context) => [context, i18n.t(COACH_WELCOME_KEYS[context], { name })])
  ) as Record<ChatMessageContext, string>;

  const legacyTexts = new Set<string>();
  for (const lng of AVAILABLE_LANGUAGES) {
    for (const context of CONTEXTS) {
      legacyTexts.add(i18n.t(COACH_WELCOME_KEYS[context], { lng, name: 'Loggy' }));
    }
  }

  await ChatService.rewriteUntouchedWelcomeMessages(textsByContext, legacyTexts);
}
