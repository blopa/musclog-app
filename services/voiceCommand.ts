import i18n from '@/lang/lang';
import { AiService } from '@/services/AiService';
import { rethrowUserFacingAiError } from '@/utils/aiErrors';
import { reportAiEvent } from '@/utils/aiTelemetry';
import {
  AiCreditsError,
  type CoachAIConfig,
  GatewayRateLimitError,
  isAiCreditsError,
  reportAiError,
  requestNativeToolCall,
  requestStructured,
} from '@/utils/coachAI';
import { prepareChatText, wrapUserContent } from '@/utils/promptSanitizer';
import { providerPolicyFor } from '@/utils/providerPolicy';
import {
  buildNativeVoiceTools,
  NATIVE_VOICE_EXAMPLES,
  nativeVoiceReply,
} from '@/utils/voiceCommand/nativeTools';
import { parseVoiceCommands } from '@/utils/voiceCommand/parse';
import { getVoiceCommandSystemPrompt } from '@/utils/voiceCommand/prompt';
import { buildVoiceCommandSchema } from '@/utils/voiceCommand/schema';
import { resolveVoiceCommand } from '@/utils/voiceCommand/tools';
import type { VoiceAction, VoiceCommand, VoiceRejection } from '@/utils/voiceCommand/types';

export type VoiceCommandOutcome =
  | { kind: 'action'; action: VoiceAction }
  | { kind: 'rejected'; reason: VoiceRejection }
  /** No AI provider can answer. */
  | { kind: 'unavailable' };

const OPERATION = 'voiceCommand';

/**
 * Asks the model which command the sentence is and reads its answer: the commands, or null for an
 * answer that cannot be read. No custom prompts, memories or persona on either path: they must not
 * change which action runs.
 */
async function requestCommands(
  config: CoachAIConfig,
  transcript: string
): Promise<VoiceCommand[] | null> {
  if (providerPolicyFor(config).nativeToolCalls) {
    // The model's own format: the example turns, then the sentence as a plain user turn (it is a
    // turn of a conversation, not text spliced into a prompt, so nothing is escaped).
    const reply = await requestNativeToolCall(config, {
      operation: OPERATION,
      messages: [...NATIVE_VOICE_EXAMPLES, { role: 'user', content: prepareChatText(transcript) }],
      tools: buildNativeVoiceTools(),
      // The transcript is what the person said: it stays out of the debug dump.
      redactDump: true,
    });

    return parseVoiceCommands(nativeVoiceReply(reply));
  }

  const result = await requestStructured(config, {
    operation: OPERATION,
    schemaName: 'voice_command',
    systemPrompt: getVoiceCommandSystemPrompt(),
    history: [],
    userMessage: wrapUserContent(transcript),
    buildSchema: buildVoiceCommandSchema,
    task: 'extraction',
    redactDump: true,
  });

  return result.kind === 'ok' ? parseVoiceCommands(result.value) : null;
}

/**
 * Works out what a spoken sentence asks the app to do. It only decides: nothing is read from or
 * written to the database, and the model's answer is relative words that code resolves against
 * `now`. One request. Throws on a provider failure (typed errors as they are, a spent allowance
 * with its message) and `AiCancelledError` on a cancel.
 */
export async function interpretVoiceCommand(
  transcript: string,
  { signal, now = new Date() }: { signal?: AbortSignal; now?: Date } = {}
): Promise<VoiceCommandOutcome> {
  const config = await AiService.getAiConfig();
  if (!config) {
    return { kind: 'unavailable' };
  }

  try {
    const commands = await requestCommands({ ...config, signal }, transcript);
    if (!commands) {
      reportAiEvent('voice-command-unusable', { provider: config.provider, operation: OPERATION });

      return { kind: 'rejected', reason: 'unreadable' };
    }

    const [command] = commands;
    if (!command) {
      return { kind: 'rejected', reason: 'cantDetermine' };
    }

    const resolution = resolveVoiceCommand(command, { now, transcript });

    return resolution.ok
      ? { kind: 'action', action: resolution.action }
      : { kind: 'rejected', reason: resolution.reason };
  } catch (error) {
    rethrowUserFacingAiError(error);
    // Tags and context only: the transcript never leaves with a report.
    reportAiError(error, 'voiceCommand.interpret');

    if (isAiCreditsError(error)) {
      throw config.provider === 'gateway'
        ? new GatewayRateLimitError(i18n.t('errors.gatewayDailyLimitError'))
        : new AiCreditsError(i18n.t('errors.aiCreditsError'));
    }

    throw error;
  }
}
