import type {
  LocalChatMessage,
  LocalToolCall,
  LocalToolDefinition,
} from '@/services/localModels/llamaRuntime';
import { isRecord } from '@/utils/isRecord';
import { SLOTS, type VoiceSlotKey } from '@/utils/voiceCommand/schema';
import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';
import { VOICE_ACTION_TOOLS, type VoiceActionTool } from '@/utils/voiceCommand/types';

/**
 * The downloaded model's own tool-call format: tool definitions, few-shot turns and the
 * conversion of its answer into the raw value `parseVoiceCommands` reads. Pure. The per-tool data
 * (offer order, description, slots, example turn) lives in each tool's `VOICE_TOOLS` entry.
 */

/** Action tools in the order the model is offered them (the model leans to the first one). */
export const NATIVE_VOICE_TOOL_ORDER: readonly VoiceActionTool[] = [...VOICE_ACTION_TOOLS].sort(
  (a, b) => VOICE_TOOLS[a].native.order - VOICE_TOOLS[b].native.order
);

export function buildNativeVoiceTools(): LocalToolDefinition[] {
  return NATIVE_VOICE_TOOL_ORDER.map((name) => {
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

function exampleTurns(name: VoiceActionTool, callId: string): LocalChatMessage[] {
  const { say, arguments: callArguments } = VOICE_TOOLS[name].native.example;

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
    .sort((a, b) => VOICE_TOOLS[a].native.example.order - VOICE_TOOLS[b].native.example.order)
    .flatMap((name, index) => exampleTurns(name, `call_${index + 1}`)),
];

/** One command of the model's answer: its `tool` and the slots it filled. */
export type NativeVoiceCommand = Record<string, unknown> & { tool: string };

/** The raw value `parseVoiceCommands` reads for the downloaded model's tool calls. */
export type NativeVoiceReply = { commands: NativeVoiceCommand[] };

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

    commands.push({ ...args, tool: call.name });
  }

  return { commands };
}
