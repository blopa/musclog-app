import { DEFAULT_LANG } from '@/lang/lang';
import { AiService } from '@/services/AiService';
import { type ChatMessage, toHistory } from '@/utils/aiOnboarding/chatState';
import type { FieldIssue, FieldKey, OnboardingAnswersDraft } from '@/utils/aiOnboarding/contract';
import type { AiOnboardingMode } from '@/utils/aiOnboarding/draftStorage';
import { mergeAnswers } from '@/utils/aiOnboarding/merge';
import { buildChatSystemPrompt } from '@/utils/aiOnboarding/prompts';
import { buildTurnJsonSchema, parseAiTurn } from '@/utils/aiOnboarding/turnSchema';
import type { CoachAIProvider } from '@/utils/coachAI';
import { sendStructuredChatTurn } from '@/utils/structuredChat';

/** Models with a small context window get the shorter prompt. */
const COMPACT_PROVIDERS = new Set<CoachAIProvider>(['on-device', 'local']);

const REPAIR_NOTE =
  '\n\nYour previous reply could not be read. Reply again with ONLY a JSON object that matches the schema exactly.';

export type OnboardingTurnInput = {
  provider: CoachAIProvider | null;
  mode: AiOnboardingMode;
  /** The answers so far, which the prompt shows the model. */
  answers: OnboardingAnswersDraft;
  /** Values from the previous turn that failed validation; the prompt asks for them again. */
  rejected: FieldIssue[];
  /** The conversation so far, without the message being sent. */
  history: ChatMessage[];
  message: string;
  signal: AbortSignal;
};

export type OnboardingTurnOutcome =
  | {
      kind: 'reply';
      reply: string;
      /** The answers with this turn's patch folded in. */
      answers: OnboardingAnswersDraft;
      rejected: FieldIssue[];
      askedFields: FieldKey[];
      readyForReview: boolean;
    }
  /** The chosen provider is no longer usable (key removed, free tier off, model gone). */
  | { kind: 'unavailable' }
  /** The model answered outside the schema twice. */
  | { kind: 'malformed' };

/**
 * One turn of the setup conversation: ask the person's chosen provider, validate the reply before
 * anything from it is used, and fold what it learned into the answers. A reply that cannot be read
 * gets one quiet second try. The model has no tools, so the worst a reply can do is propose an
 * answer the person then reviews. Provider failures are thrown as typed errors for the caller to
 * classify.
 */
export async function runOnboardingTurn(
  input: OnboardingTurnInput
): Promise<OnboardingTurnOutcome> {
  const config = input.provider ? await AiService.getAiConfigForProvider(input.provider) : null;
  if (!config) {
    return { kind: 'unavailable' };
  }

  const ask = async (repair: boolean) => {
    const result = await sendStructuredChatTurn(
      { ...config, signal: input.signal },
      {
        operation: 'aiOnboardingTurn',
        systemPrompt:
          buildChatSystemPrompt({
            mode: input.mode,
            language: config.language ?? DEFAULT_LANG,
            draft: input.answers,
            compact: COMPACT_PROVIDERS.has(config.provider),
            today: new Date(),
            rejected: input.rejected,
          }) + (repair ? REPAIR_NOTE : ''),
        history: toHistory(input.history),
        userMessage: input.message,
        buildSchema: buildTurnJsonSchema,
        schemaName: 'onboarding_turn',
      }
    );

    return result.kind === 'ok' ? parseAiTurn(result.value, new Date()) : ({ ok: false } as const);
  };

  // Models occasionally answer outside the schema; one quiet second try is usually enough.
  let parsed = await ask(false);
  if (!parsed.ok) {
    parsed = await ask(true);
  }

  if (!parsed.ok) {
    return { kind: 'malformed' };
  }

  return {
    kind: 'reply',
    reply: parsed.reply,
    answers: mergeAnswers(input.answers, parsed.draftPatch).draft,
    rejected: parsed.rejected,
    askedFields: parsed.askedFields,
    readyForReview: parsed.readyForReview,
  };
}
