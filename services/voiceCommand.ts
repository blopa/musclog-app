import i18n from '@/lang/lang';
import { AiService } from '@/services/AiService';
import { rethrowUserFacingAiError } from '@/utils/aiErrors';
import { reportAiEvent } from '@/utils/aiTelemetry';
import {
  AiCreditsError,
  GatewayRateLimitError,
  isAiCreditsError,
  reportAiError,
  requestStructured,
} from '@/utils/coachAI';
import { wrapUserContent } from '@/utils/promptSanitizer';
import { parseVoiceCommands } from '@/utils/voiceCommand/parse';
import { getVoiceCommandSystemPrompt } from '@/utils/voiceCommand/prompt';
import { buildVoiceCommandSchema } from '@/utils/voiceCommand/schema';
import { resolveVoiceCommand } from '@/utils/voiceCommand/tools';
import type { VoiceAction, VoiceRejection } from '@/utils/voiceCommand/types';

export type VoiceCommandOutcome =
  | { kind: 'action'; action: VoiceAction }
  | { kind: 'rejected'; reason: VoiceRejection }
  /** No AI provider can answer. */
  | { kind: 'unavailable' };

const OPERATION = 'voiceCommand';

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
    const result = await requestStructured(
      { ...config, signal },
      {
        operation: OPERATION,
        schemaName: 'voice_command',
        // No custom prompts, memories or persona: they must not change which action runs.
        systemPrompt: getVoiceCommandSystemPrompt(),
        history: [],
        userMessage: wrapUserContent(transcript),
        buildSchema: buildVoiceCommandSchema,
        task: 'extraction',
      }
    );
    const commands = result.kind === 'ok' ? parseVoiceCommands(result.value) : null;
    if (!commands) {
      reportAiEvent('voice-command-unusable', { provider: config.provider, operation: OPERATION });

      return { kind: 'rejected', reason: 'unreadable' };
    }

    const [command] = commands;
    if (!command) {
      return { kind: 'rejected', reason: 'cantDetermine' };
    }

    const resolution = resolveVoiceCommand(command, now);

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
