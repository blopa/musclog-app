import type {
  LocalChatMessage,
  LocalToolCall,
  LocalToolDefinition,
} from '@/services/localModels/llamaRuntime';
import { isRecord } from '@/utils/isRecord';
import { SLOTS, type VoiceSlotKey } from '@/utils/voiceCommand/schema';
import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';
import type { VoiceActionTool } from '@/utils/voiceCommand/types';

/**
 * The downloaded model's own tool-call format: tool definitions, few-shot turns and the
 * conversion of its answer into the raw value `parseVoiceCommands` reads. Pure.
 */

// The model leans to the first tool it is offered: with copy_meal first it called copy_meal for
// most foods, with search_food first foods went 9 of 11 right (measured 2026-11-26,
// LFM2.5-VL-450M Q4_0).
export const NATIVE_VOICE_TOOL_ORDER = [
  'search_food',
  'copy_meal',
] as const satisfies readonly VoiceActionTool[];

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

// These turns were measured as a set: do not reorder them or add one without measuring again.
export const NATIVE_VOICE_EXAMPLES: readonly LocalChatMessage[] = [
  { role: 'user', content: 'Hi, my name is Anna' },
  { role: 'assistant', content: 'Hi Anna!' },
  { role: 'user', content: 'What did I eat on Monday?' },
  { role: 'assistant', content: 'I can only log food.' },
  { role: 'user', content: 'Same breakfast as yesterday' },
  {
    role: 'assistant',
    content: '',
    toolCalls: [
      {
        id: 'call_1',
        name: 'copy_meal',
        arguments: '{"meal":"breakfast","from_day":"yesterday"}',
      },
    ],
  },
  { role: 'tool', toolCallId: 'call_1', content: 'ok' },
  { role: 'assistant', content: 'Done.' },
  { role: 'user', content: 'I had a banana' },
  {
    role: 'assistant',
    content: '',
    toolCalls: [{ id: 'call_2', name: 'search_food', arguments: '{"food":"banana"}' }],
  },
  { role: 'tool', toolCallId: 'call_2', content: 'ok' },
  { role: 'assistant', content: 'Done.' },
];

/** The engine's answer as the raw value `parseVoiceCommands` reads; null when it cannot be read. */
export function nativeVoiceReply(reply: { text: string; toolCalls: LocalToolCall[] }): unknown {
  // Plain text is not a request to do something.
  if (reply.toolCalls.length === 0) {
    return { commands: [{ tool: 'none' }] };
  }

  const commands: Record<string, unknown>[] = [];
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
