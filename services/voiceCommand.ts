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
  nativeVoiceMessages,
  nativeVoiceReply,
} from '@/utils/voiceCommand/nativeTools';
import { parseChosenCommand, parseVoiceCommands } from '@/utils/voiceCommand/parse';
import { getVoiceCommandSystemPrompt } from '@/utils/voiceCommand/prompt';
import { buildVoiceCommandSchema } from '@/utils/voiceCommand/schema';
import { resolveVoiceCommand } from '@/utils/voiceCommand/tools';
import {
  activeVoiceTools,
  canOfferVoiceTool,
  parseVoiceToolSelection,
} from '@/utils/voiceCommand/toolSelection';
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

  const { nativeToolCalls, nativeVoiceModel } = providerPolicyFor(config);
  if (nativeToolCalls) {
    // The model's own format: what this model is given first (example turns or an instruction), then
    // the sentence as a plain user turn (it is a turn of a conversation, not text spliced into a
    // prompt, so nothing is escaped).
    const reply = await requestNativeToolCall(config, {
      operation: OPERATION,
      messages: [
        ...nativeVoiceMessages(offered, chosen, nativeVoiceModel),
        { role: 'user', content: prepareChatText(transcript) },
      ],
      tools: buildNativeVoiceTools(offered, chosen, nativeVoiceModel),
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
 * Works out what a spoken sentence asks the app to do, among the tools the person chose (those this
 * phone can run, cut to what the model in use can choose between). It only decides: nothing is
 * written, and the model's answer is relative words that code resolves against `now`. At most one
 * request. Throws on a provider failure (typed errors as they are, a spent allowance with its
 * message) and `AiCancelledError` on a cancel. With `tool` (the person's pick) the answer is always
 * that tool's action.
 */
export async function interpretVoiceCommand(
  transcript: string,
  {
    signal,
    now = new Date(),
    tool,
    hasCamera = true,
  }: { signal?: AbortSignal; now?: Date; tool?: VoiceActionTool; hasCamera?: boolean } = {}
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
    const { maxVoiceTools, nativeToolCalls } = providerPolicyFor(config);
    const available = (name: VoiceActionTool) =>
      canOfferVoiceTool(name, { hasCamera, nativeModel: Boolean(nativeToolCalls) });
    const offered = activeVoiceTools(parseVoiceToolSelection(stored), maxVoiceTools, available);
    // The camera or the model may have changed since the tool was picked.
    if (tool && !available(tool)) {
      return { kind: 'rejected', reason: 'cantDetermine', offered };
    }

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
      units,
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
