import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
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
  nativeVoiceExamples,
  nativeVoiceReply,
} from '@/utils/voiceCommand/nativeTools';
import { parseChosenCommand, parseVoiceCommands } from '@/utils/voiceCommand/parse';
import { getVoiceCommandSystemPrompt } from '@/utils/voiceCommand/prompt';
import { buildVoiceCommandSchema } from '@/utils/voiceCommand/schema';
import { resolveVoiceCommand } from '@/utils/voiceCommand/tools';
import { activeVoiceTools, parseVoiceToolSelection } from '@/utils/voiceCommand/toolSelection';
import type {
  VoiceAction,
  VoiceActionTool,
  VoiceCommand,
  VoiceRejection,
} from '@/utils/voiceCommand/types';

/** `offered`: the tools the request offered, which the person can pick from to say what they meant. */
export type VoiceCommandOutcome =
  | { kind: 'action'; action: VoiceAction; offered: VoiceActionTool[] }
  | { kind: 'rejected'; reason: VoiceRejection; offered: VoiceActionTool[] }
  /** No AI provider can answer. */
  | { kind: 'unavailable' };

const OPERATION = 'voiceCommand';

/**
 * Asks the model which of the offered commands the sentence is and reads its answer: the commands,
 * or null for an answer that cannot be read. No custom prompts, memories or persona on either path:
 * they must not change which action runs. `chosen` is the tool the person picked after a first try
 * failed: the request offers only that tool, and its answer is always read as that tool.
 */
async function requestCommands(
  config: CoachAIConfig,
  transcript: string,
  offered: VoiceActionTool[],
  chosen?: VoiceActionTool
): Promise<VoiceCommand[] | null> {
  const read = (raw: unknown) =>
    chosen ? [parseChosenCommand(raw, chosen)] : parseVoiceCommands(raw, offered);

  if (providerPolicyFor(config).nativeToolCalls) {
    // The model's own format: the example turns, then the sentence as a plain user turn (it is a
    // turn of a conversation, not text spliced into a prompt, so nothing is escaped).
    const reply = await requestNativeToolCall(config, {
      operation: OPERATION,
      messages: [
        ...nativeVoiceExamples(offered),
        { role: 'user', content: prepareChatText(transcript) },
      ],
      tools: buildNativeVoiceTools(offered, chosen),
      // The transcript is what the person said: it stays out of the debug dump.
      redactDump: true,
    });

    return read(nativeVoiceReply(reply));
  }

  const result = await requestStructured(config, {
    operation: OPERATION,
    schemaName: 'voice_command',
    systemPrompt: getVoiceCommandSystemPrompt(offered, chosen),
    history: [],
    userMessage: wrapUserContent(transcript),
    buildSchema: (dialect) => buildVoiceCommandSchema(dialect, offered, chosen),
    task: 'extraction',
    redactDump: true,
  });

  if (result.kind === 'ok') {
    return read(result.value);
  }

  return chosen ? read(null) : null;
}

/**
 * Works out what a spoken sentence asks the app to do, among the tools the person chose (cut to
 * what the model in use can choose between). It only decides: nothing is written, and the model's
 * answer is relative words that code resolves against `now`. One request. Throws on a provider
 * failure (typed errors as they are, a spent allowance with its message) and `AiCancelledError` on
 * a cancel. With `tool` (the person's pick) the answer is always that tool's action.
 */
export async function interpretVoiceCommand(
  transcript: string,
  {
    signal,
    now = new Date(),
    tool,
  }: { signal?: AbortSignal; now?: Date; tool?: VoiceActionTool } = {}
): Promise<VoiceCommandOutcome> {
  const config = await AiService.getAiConfig();
  if (!config) {
    return { kind: 'unavailable' };
  }

  try {
    const [stored, units] = await Promise.all([
      SettingsService.get(SETTINGS.voiceCommandTools),
      SettingsService.getUnits(),
    ]);
    const offered = activeVoiceTools(
      parseVoiceToolSelection(stored),
      providerPolicyFor(config).maxVoiceTools
    );
    // A picked tool was offered a moment ago; it stays usable if the choice changed since.
    const usable = tool && !offered.includes(tool) ? [...offered, tool] : offered;
    const commands = await requestCommands({ ...config, signal }, transcript, usable, tool);
    if (!commands) {
      reportAiEvent('voice-command-unusable', { provider: config.provider, operation: OPERATION });

      return { kind: 'rejected', reason: 'unreadable', offered };
    }

    const [command] = commands;
    if (!command) {
      return { kind: 'rejected', reason: 'cantDetermine', offered };
    }

    const resolution = resolveVoiceCommand(command, {
      now,
      transcript,
      weightUnit: units === 'imperial' ? 'lb' : 'kg',
      chosen: Boolean(tool),
    });

    return resolution.ok
      ? { kind: 'action', action: resolution.action, offered }
      : { kind: 'rejected', reason: resolution.reason, offered };
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
