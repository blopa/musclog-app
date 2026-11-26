import {
  buildNativeVoiceTools,
  NATIVE_VOICE_EXAMPLES,
  NATIVE_VOICE_TOOL_ORDER,
  nativeVoiceReply,
} from '@/utils/voiceCommand/nativeTools';
import { parseVoiceCommands } from '@/utils/voiceCommand/parse';
import { SLOTS } from '@/utils/voiceCommand/schema';
import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';
import { VOICE_ACTION_TOOLS } from '@/utils/voiceCommand/types';

describe('buildNativeVoiceTools', () => {
  it('offers search_food first, then copy_meal', () => {
    expect(buildNativeVoiceTools().map((tool) => tool.name)).toEqual(['search_food', 'copy_meal']);
  });

  it('lists every action tool exactly once', () => {
    expect([...NATIVE_VOICE_TOOL_ORDER].sort()).toEqual([...VOICE_ACTION_TOOLS].sort());
  });

  it('describes each tool and its slots from the registry, with enums from the slot choices', () => {
    for (const tool of buildNativeVoiceTools()) {
      const { native } = VOICE_TOOLS[tool.name as keyof typeof VOICE_TOOLS];
      const parameters = tool.parameters as {
        type: string;
        properties: Record<string, { type: string; enum?: string[]; description: string }>;
        required: string[];
      };

      expect(tool.description).toBe(native.description);
      expect(parameters.type).toBe('object');
      expect(parameters.required).toEqual([]);
      // The registry's own order, which is the order the model was measured with.
      expect(Object.keys(parameters.properties)).toEqual(Object.keys(native.slots));

      for (const [key, property] of Object.entries(parameters.properties)) {
        const slot = SLOTS[key as keyof typeof SLOTS];
        const choices: readonly string[] | undefined = 'choices' in slot ? slot.choices : undefined;
        expect(property.type).toBe('string');
        expect(property.enum).toEqual(choices ? [...choices] : undefined);
        expect(property.description).toBe(native.slots[key as keyof typeof SLOTS]);
      }
    }
  });
});

it('offers the food search first, with the food as its first slot', () => {
  const [first, second] = buildNativeVoiceTools();
  const properties = (first.parameters as { properties: Record<string, unknown> }).properties;

  expect([first.name, second.name]).toEqual(['search_food', 'copy_meal']);
  expect(Object.keys(properties)).toEqual(['food', 'meal', 'day']);
});

describe('NATIVE_VOICE_EXAMPLES', () => {
  it('follows every tool call with a tool message of the same id', () => {
    NATIVE_VOICE_EXAMPLES.forEach((message, index) => {
      for (const call of message.toolCalls ?? []) {
        const next = NATIVE_VOICE_EXAMPLES[index + 1];

        expect(next.role).toBe('tool');
        expect(next.toolCallId).toBe(call.id);
      }
    });
  });

  it('calls real tools that parse to the intended commands', () => {
    const calls = NATIVE_VOICE_EXAMPLES.flatMap((message) => message.toolCalls ?? []);
    const parsed = calls.map((call) =>
      parseVoiceCommands(nativeVoiceReply({ text: '', toolCalls: [call] }))
    );

    expect(parsed).toEqual([
      [
        {
          tool: 'copy_meal',
          meal: 'breakfast',
          day: null,
          fromMeal: null,
          fromDay: 'yesterday',
          food: null,
        },
      ],
      [
        {
          tool: 'search_food',
          meal: null,
          day: null,
          fromMeal: null,
          fromDay: null,
          food: 'banana',
        },
      ],
    ]);
  });
});

describe('nativeVoiceReply', () => {
  const call = (args: string, name = 'search_food') => ({ id: 'c', name, arguments: args });

  it('reads plain text as not a request', () => {
    expect(nativeVoiceReply({ text: 'Hi Pablo!', toolCalls: [] })).toEqual({
      commands: [{ tool: 'none' }],
    });
  });

  it('turns a call into a command', () => {
    expect(nativeVoiceReply({ text: '', toolCalls: [call('{"food":"egg"}')] })).toEqual({
      commands: [{ food: 'egg', tool: 'search_food' }],
    });
  });

  it('reads blank arguments as none given', () => {
    expect(nativeVoiceReply({ text: '', toolCalls: [call('  ', 'copy_meal')] })).toEqual({
      commands: [{ tool: 'copy_meal' }],
    });
  });

  it('is unreadable for arguments that are not a JSON object', () => {
    expect(nativeVoiceReply({ text: '', toolCalls: [call('{oops')] })).toBeNull();
    expect(nativeVoiceReply({ text: '', toolCalls: [call('["a"]')] })).toBeNull();
    expect(nativeVoiceReply({ text: '', toolCalls: [call('"x"')] })).toBeNull();
  });

  it('keeps the tool name over an argument named tool', () => {
    expect(
      nativeVoiceReply({ text: '', toolCalls: [call('{"tool":"none","food":"egg"}')] })
    ).toEqual({ commands: [{ tool: 'search_food', food: 'egg' }] });
  });
});
