import i18n, { DEFAULT_LANG } from '@/lang/lang';
import { rethrowUserFacingAiError } from '@/utils/aiErrors';
import {
  AiCreditsError,
  type ChatHistoryEntry,
  type CoachAIConfig,
  GatewayRateLimitError,
  isAiCreditsError,
  normalizeHistory,
  PROVIDER_CONFIGS,
  reportAiError,
  requestStructured,
  type StructuredDialect,
  type StructuredResult,
  truncateHistoryByBudget,
} from '@/utils/coachAI';

export type StructuredTurnRequest = {
  /** Names the call in debug dumps and retry logs. */
  operation: string;
  systemPrompt: string;
  /** The conversation so far, without the message being sent. */
  history: ChatHistoryEntry[];
  userMessage: string;
  /** Each provider takes the schema in a slightly different dialect. */
  buildSchema: (dialect: StructuredDialect) => object;
  schemaName: string;
};

/** A person's chat message is capped, not rewritten: nothing here executes what the model returns. */
const STRUCTURED_TURN_MAX_USER_CHARS = 2000;

/**
 * One turn of a multi-turn conversation whose reply must match a JSON schema. Unlike
 * `generateStructured` it keeps history, and it throws typed errors (bad key, timeout, cancel,
 * exhausted credits, dropped connection) instead of returning null, so the caller can offer the
 * right next step. A reply that is not valid JSON comes back as `malformed` rather than an error.
 *
 * The message is trusted no more than any other user text: it is length-capped, and the caller
 * validates what comes back before using any of it.
 */
export async function sendStructuredChatTurn(
  config: CoachAIConfig,
  request: StructuredTurnRequest
): Promise<StructuredResult> {
  const lang = config.language ?? DEFAULT_LANG;
  const userMessage = request.userMessage.trim().slice(0, STRUCTURED_TURN_MAX_USER_CHARS);
  const systemPrompt = `${request.systemPrompt}\n\nRespond in the following language/locale: ${lang}. All user-facing content in the structured output must be in this language.`;

  const budget =
    PROVIDER_CONFIGS[config.provider].maxCharBudget - systemPrompt.length - userMessage.length;
  const history = normalizeHistory(
    budget > 0 ? truncateHistoryByBudget(request.history, budget) : []
  );
  // Providers want the conversation to open with the person, not the assistant.
  while (history.length > 0 && history[0].role === 'coach') {
    history.shift();
  }

  try {
    return await requestStructured(config, { ...request, systemPrompt, history, userMessage });
  } catch (error) {
    rethrowUserFacingAiError(error);
    reportAiError(error, `coachAI.sendStructuredChatTurn[${request.operation}]`);

    if (isAiCreditsError(error)) {
      throw config.provider === 'gateway'
        ? new GatewayRateLimitError(i18n.t('errors.gatewayDailyLimitError'))
        : new AiCreditsError(i18n.t('errors.aiCreditsError'));
    }

    throw error;
  }
}
