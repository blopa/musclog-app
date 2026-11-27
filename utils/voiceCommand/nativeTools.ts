import type {
  LocalChatMessage,
  LocalToolCall,
  LocalToolDefinition,
} from '@/services/localModels/llamaRuntime';
import { isRecord } from '@/utils/isRecord';
import { SLOTS, type VoiceSlotKey } from '@/utils/voiceCommand/schema';
import { VOICE_TOOLS, type VoiceExample } from '@/utils/voiceCommand/tools';
import { VOICE_ACTION_TOOLS, type VoiceActionTool } from '@/utils/voiceCommand/types';

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
 * The tools offered. `only` is the tool the person picked: offering it alone, with the same example
 * turns, is what makes the model call it (`tool_choice: 'required'` measured no different).
 */
export function buildNativeVoiceTools(only?: VoiceActionTool): LocalToolDefinition[] {
  return NATIVE_VOICE_TOOL_ORDER.filter((name) => !only || name === only).map((name) => {
    const { description, slots } = VOICE_TOOLS[name].native;
    const properties: Record<string, object> = {};
    // The registry's own order: the model was measured with food first for search_food.
    for (const [key, slotDescription] of Object.entries(slots) as [VoiceSlotKey, string][]) {
      const slot = SLOTS[key];
      const choices: readonly string[] | undefined = 'choices' in slot ? slot.choices : undefined;
      properties[key] = {
        type: 'string',
        ...(choices ? { enum: [...choices] } : {}),
        description: slotDescription,
      };
    }

    return { name, description, parameters: { type: 'object', properties, required: [] } };
  });
}

/** The turns before the tool examples: a greeting, a question the model must not answer with a tool. */
const EXAMPLE_PREAMBLE: readonly LocalChatMessage[] = [
  { role: 'user', content: 'Hi, my name is Anna' },
  { role: 'assistant', content: 'Hi Anna!' },
  { role: 'user', content: 'What did I eat on Monday?' },
  { role: 'assistant', content: 'I can only log food.' },
];

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

// These turns were measured as a set: do not reorder them or add one without measuring again.
export const NATIVE_VOICE_EXAMPLES: readonly LocalChatMessage[] = [
  ...EXAMPLE_PREAMBLE,
  ...[...VOICE_ACTION_TOOLS]
    .sort((a, b) => VOICE_TOOLS[a].native.examples.order - VOICE_TOOLS[b].native.examples.order)
    .flatMap((name) => VOICE_TOOLS[name].native.examples.turns.map((turn) => ({ name, turn })))
    .flatMap(({ name, turn }, index) => exampleTurns(name, turn, `call_${index + 1}`)),
];

/** One command of the model's answer: its `tool` and the slots it filled. */
export type NativeVoiceCommand = Record<string, unknown> & { tool: string };

/** The raw value `parseVoiceCommands` reads for the downloaded model's tool calls. */
export type NativeVoiceReply = { commands: NativeVoiceCommand[] };

/** One `"key": "text"` pair of a flat JSON object, or any other quoted string (skipped whole). */
const STRING_PAIR = /("(?:[^"\\]|\\.)*")(?:\s*:\s*("(?:[^"\\]|\\.)*"))?/g;

function isValidSlot(key: string, value: unknown): boolean {
  const slot = (SLOTS as Record<string, { choices?: readonly string[] }>)[key];
  if (typeof value !== 'string') {
    return false;
  }

  return slot?.choices ? slot.choices.includes(value.trim().toLowerCase()) : value.trim() !== '';
}

/**
 * A small model sometimes writes one key twice (`"from_day":"yesterday","from_day":"tomorrow"`),
 * and `JSON.parse` keeps the last even when it is filler. The last VALID value of a slot wins, and
 * "today" never replaces a real day as the source of a copy. A slot with no valid value stays as
 * parsed, so the command is still dropped. `source` must already parse.
 */
function bestSlots(source: string, parsed: Record<string, unknown>): Record<string, unknown> {
  const result = { ...parsed };
  const picked = new Map<string, string>();
  for (const [, rawKey, rawValue] of source.matchAll(STRING_PAIR)) {
    if (rawValue === undefined) {
      continue;
    }

    const key = JSON.parse(rawKey) as string;
    const value = JSON.parse(rawValue) as string;
    const replacesRealSource = key === 'from_day' && value === 'today' && picked.has(key);
    if (key in SLOTS && isValidSlot(key, value) && !replacesRealSource) {
      picked.set(key, value);
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
    // Filler: the model writes "other" when no meal was said, and a search then follows the clock.
    if (command.tool === 'search_food' && command.meal === 'other') {
      delete command.meal;
    }

    commands.push(command);
  }

  return { commands };
}
