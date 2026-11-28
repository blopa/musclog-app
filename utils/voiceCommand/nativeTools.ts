import type {
  LocalChatMessage,
  LocalToolCall,
  LocalToolDefinition,
} from '@/services/localModels/llamaRuntime';
import { isRecord } from '@/utils/isRecord';
import { slotChoices, SLOTS, type VoiceSlotKey } from '@/utils/voiceCommand/schema';
import { VOICE_TOOLS, type VoiceExample } from '@/utils/voiceCommand/tools';
import {
  type NativeVoiceModel,
  VOICE_ACTION_TOOLS,
  type VoiceActionTool,
} from '@/utils/voiceCommand/types';

/**
 * The downloaded model's own tool-call format: tool definitions, few-shot turns and the
 * conversion of its answer into the raw value `parseVoiceCommands` reads. Pure. The per-tool data
 * (offer order, description, slots, example turns) lives in each tool's `VOICE_TOOLS` entry.
 */

/** Action tools in the order the model is offered them (the model leans to the first one). */
export const NATIVE_VOICE_TOOL_ORDER: readonly VoiceActionTool[] = [...VOICE_ACTION_TOOLS].sort(
  (a, b) => VOICE_TOOLS[a].native.order - VOICE_TOOLS[b].native.order
);

/**
 * The tools of a request: the offered ones, or the one the person picked (`chosen`). Offering that
 * one alone is what makes the model call it (`tool_choice: 'required'` measured no different).
 */
export function buildNativeVoiceTools(
  offered: readonly VoiceActionTool[] = VOICE_ACTION_TOOLS,
  chosen?: VoiceActionTool,
  model: NativeVoiceModel = 'main'
): LocalToolDefinition[] {
  return NATIVE_VOICE_TOOL_ORDER.filter((name) =>
    chosen ? name === chosen : offered.includes(name)
  ).map((name) => {
    const { native } = VOICE_TOOLS[name];
    const { description, slots } = (model === 'text' && native.textModel) || native;
    const properties: Record<string, object> = {};
    // The registry's own order: the model was measured with food first for search_food.
    for (const [key, slotDescription] of Object.entries(slots) as [VoiceSlotKey, string][]) {
      const choices = slotChoices(key);
      properties[key] = {
        type: 'string',
        ...(choices ? { enum: [...choices] } : {}),
        description: slotDescription,
      };
    }

    return { name, description, parameters: { type: 'object', properties, required: [] } };
  });
}

/** What the model "says" to a question: true of the set of tools it is offered. */
function refusal(offered: readonly VoiceActionTool[]): string {
  return offered.every((name) => VOICE_TOOLS[name].native.logsFood)
    ? 'I can only log food.'
    : 'I can only do things in the app.';
}

/** The turns before the tool examples: a greeting, a question the model must not answer with a tool. */
function examplePreamble(offered: readonly VoiceActionTool[]): LocalChatMessage[] {
  return [
    { role: 'user', content: 'Hi, my name is Anna' },
    { role: 'assistant', content: 'Hi Anna!' },
    { role: 'user', content: 'What did I eat on Monday?' },
    { role: 'assistant', content: refusal(offered) },
  ];
}

function exampleTurns(
  name: VoiceActionTool,
  { say, arguments: callArguments }: VoiceExample,
  callId: string
): LocalChatMessage[] {
  return [
    { role: 'user', content: say },
    {
      role: 'assistant',
      content: '',
      toolCalls: [{ id: callId, name, arguments: callArguments }],
    },
    { role: 'tool', toolCallId: callId, content: 'ok' },
    { role: 'assistant', content: 'Done.' },
  ];
}

/**
 * The example turns of the offered tools only. The turns of the default sets were measured as a
 * whole: do not reorder them or add one without measuring again.
 */
export function nativeVoiceExamples(
  offered: readonly VoiceActionTool[] = VOICE_ACTION_TOOLS
): LocalChatMessage[] {
  return [
    ...examplePreamble(offered),
    ...VOICE_ACTION_TOOLS.filter((name) => offered.includes(name))
      .sort((a, b) => VOICE_TOOLS[a].native.examples.order - VOICE_TOOLS[b].native.examples.order)
      .flatMap((name) => VOICE_TOOLS[name].native.examples.turns.map((turn) => ({ name, turn })))
      .flatMap(({ name, turn }, index) => exampleTurns(name, turn, `call_${index + 1}`)),
  ];
}

/**
 * The 1.2B is told what to do instead of being shown example turns: shown its own example calls it
 * acted on 21 of 83 sentences wrongly, and told in these words on far fewer. Measured as written.
 */
const TEXT_MODEL_INSTRUCTION =
  'Call a tool only when the sentence asks the app to log, copy, open or write something. ' +
  'Otherwise reply "Okay." and call no tool. A greeting, thanks or a question is not a request.';

/**
 * What a downloaded model is given before the sentence. The 1.2B gets the instruction on a first
 * try, and the example turns once the person picked the tool (`chosen`): with them it called the
 * tool for all 101 sentences tried (92 with the instruction) and filled more slots right.
 */
export function nativeVoiceMessages(
  offered: readonly VoiceActionTool[] = VOICE_ACTION_TOOLS,
  chosen?: VoiceActionTool,
  model: NativeVoiceModel = 'main'
): LocalChatMessage[] {
  return model === 'text' && !chosen
    ? [{ role: 'system', content: TEXT_MODEL_INSTRUCTION }]
    : nativeVoiceExamples(offered);
}

/** One command of the model's answer: its `tool` and the slots it filled. */
export type NativeVoiceCommand = Record<string, unknown> & { tool: string };

/** The raw value `parseVoiceCommands` reads for the downloaded model's tool calls. */
export type NativeVoiceReply = { commands: NativeVoiceCommand[] };

/**
 * One `"key": value` pair of a flat JSON object with a text or number value, or any other quoted
 * string (skipped whole).
 */
const SLOT_PAIR = /("(?:[^"\\]|\\.)*")(?:\s*:\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?))?/g;

function isSlot(key: string): key is VoiceSlotKey {
  return key in SLOTS;
}

function isValidSlot(key: VoiceSlotKey, value: unknown): boolean {
  if (SLOTS[key].kind === 'number' && typeof value === 'number') {
    return true;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const choices = slotChoices(key);

  return choices ? choices.includes(value.trim().toLowerCase()) : value.trim() !== '';
}

/**
 * A small model sometimes writes one key twice (`"from_day":"yesterday","from_day":"tomorrow"`),
 * and `JSON.parse` keeps the last even when it is filler. The last VALID value of a slot wins, and
 * "today" never replaces a real day as the source of a copy. A slot with no valid value stays as
 * parsed, so the command is still dropped. `source` must already parse.
 */
function bestSlots(source: string, parsed: Record<string, unknown>): Record<string, unknown> {
  const result = { ...parsed };
  const picked = new Set<string>();
  for (const [, rawKey, rawValue] of source.matchAll(SLOT_PAIR)) {
    if (rawValue === undefined) {
      continue;
    }

    const key = JSON.parse(rawKey) as string;
    const value = JSON.parse(rawValue) as unknown;
    const replacesRealSource = key === 'from_day' && value === 'today' && picked.has(key);
    if (isSlot(key) && isValidSlot(key, value) && !replacesRealSource) {
      picked.add(key);
      result[key] = value;
    }
  }

  return result;
}

/** The engine's answer as the raw value `parseVoiceCommands` reads; null when it cannot be read. */
export function nativeVoiceReply(reply: {
  text: string;
  toolCalls: LocalToolCall[];
}): NativeVoiceReply | null {
  // Plain text is not a request to do something.
  if (reply.toolCalls.length === 0) {
    return { commands: [{ tool: 'none' }] };
  }

  const commands: NativeVoiceCommand[] = [];
  for (const call of reply.toolCalls) {
    let args: unknown = {};
    if (call.arguments.trim()) {
      try {
        args = JSON.parse(call.arguments);
      } catch {
        return null;
      }
    }

    if (!isRecord(args)) {
      return null;
    }

    const command: NativeVoiceCommand = { ...bestSlots(call.arguments, args), tool: call.name };
    // Filler: the model writes "other" when no meal was said, and the meal then follows the clock.
    const native = Object.entries(VOICE_TOOLS).find(([name]) => name === command.tool)?.[1].native;
    if (native?.dropsOtherMeal && command.meal === 'other') {
      delete command.meal;
    }

    commands.push(command);
  }

  return { commands };
}
