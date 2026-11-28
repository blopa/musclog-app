import {
  buildNativeVoiceTools,
  NATIVE_VOICE_TOOL_ORDER,
  nativeVoiceExamples,
  nativeVoiceMessages,
  nativeVoiceReply,
} from '@/utils/voiceCommand/nativeTools';
import { parseVoiceCommands } from '@/utils/voiceCommand/parse';
import { SLOTS } from '@/utils/voiceCommand/schema';
import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';
import { activeVoiceTools, DEFAULT_VOICE_TOOL_SELECTION } from '@/utils/voiceCommand/toolSelection';
import { VOICE_ACTION_TOOLS, type VoiceActionTool } from '@/utils/voiceCommand/types';

/** The two tools the downloaded model's frozen literals were measured with. */
const TWO: readonly VoiceActionTool[] = ['search_food', 'copy_meal'];

describe('buildNativeVoiceTools', () => {
  it('offers search_food first, then copy_meal', () => {
    expect(buildNativeVoiceTools(TWO).map((tool) => tool.name)).toEqual([
      'search_food',
      'copy_meal',
    ]);
  });

  it('lists every action tool exactly once', () => {
    expect([...NATIVE_VOICE_TOOL_ORDER].sort()).toEqual([...VOICE_ACTION_TOOLS].sort());
  });

  it('describes each tool and its slots from the registry, with enums from the slot choices', () => {
    for (const tool of buildNativeVoiceTools(VOICE_ACTION_TOOLS)) {
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
  const [first, second] = buildNativeVoiceTools(TWO);
  const properties = (first.parameters as { properties: Record<string, unknown> }).properties;

  expect([first.name, second.name]).toEqual(['search_food', 'copy_meal']);
  expect(Object.keys(properties)).toEqual(['food', 'meal', 'day']);
});

describe('nativeVoiceExamples', () => {
  it('follows every tool call with a tool message of the same id', () => {
    const examples = nativeVoiceExamples(TWO);

    examples.forEach((message, index) => {
      for (const call of message.toolCalls ?? []) {
        const next = examples[index + 1];

        expect(next.role).toBe('tool');
        expect(next.toolCallId).toBe(call.id);
      }
    });
  });

  it('calls real tools that parse to the intended commands', () => {
    const calls = nativeVoiceExamples(TWO).flatMap((message) => message.toolCalls ?? []);
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
          weight: null,
          text: null,
          screen: null,
          cameraMode: null,
          activity: null,
        },
      ],
      [
        {
          tool: 'copy_meal',
          meal: 'lunch',
          day: 'today',
          fromMeal: null,
          fromDay: 'yesterday',
          food: null,
          weight: null,
          text: null,
          screen: null,
          cameraMode: null,
          activity: null,
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
          weight: null,
          text: null,
          screen: null,
          cameraMode: null,
          activity: null,
        },
      ],
    ]);
  });
});

describe('nativeVoiceReply', () => {
  const call = (args: string, name = 'search_food') => ({ id: 'c', name, arguments: args });

  it('reads "other" on a food search as no meal, and keeps it on a copy', () => {
    expect(
      nativeVoiceReply({ text: '', toolCalls: [call('{"food":"egg","meal":"other"}')] })
    ).toEqual({ commands: [{ food: 'egg', tool: 'search_food' }] });
    expect(
      nativeVoiceReply({ text: '', toolCalls: [call('{"meal":"other"}', 'copy_meal')] })
    ).toEqual({ commands: [{ meal: 'other', tool: 'copy_meal' }] });
  });

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

describe('nativeVoiceReply with a repeated key', () => {
  const fromDay = (...values: string[]) => {
    const pairs = values.map((value) => `"from_day":"${value}"`).join(',');
    const reply = nativeVoiceReply({
      text: '',
      toolCalls: [{ id: 'c', name: 'copy_meal', arguments: `{"meal":"lunch",${pairs}}` }],
    });

    return reply?.commands[0].from_day;
  };

  it.each([
    [['yesterday', 'tomorrow'], 'yesterday'],
    [['yesterday', 'monday'], 'monday'],
    [['yesterday', 'today'], 'yesterday'],
    [['today'], 'today'],
    [['yesterday', 'heute'], 'yesterday'],
    [['tomorrow'], 'tomorrow'],
  ])('reads %j as %s', (values, expected) => {
    expect(fromDay(...values)).toBe(expected);
  });
});

/**
 * Frozen literal output. The downloaded model's tools, order and example turns were measured as a
 * set: a refactor must reproduce these exact values, not the registry it is derived from.
 */
describe('frozen native voice output', () => {
  const meals = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];
  const sourceDays = [
    'today',
    'yesterday',
    'two_days_ago',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  it('offers search_food then copy_meal, with these descriptions and slots', () => {
    expect(buildNativeVoiceTools(TWO)).toEqual([
      {
        name: 'search_food',
        description: 'Log one food the person names, such as banana, eggs or a protein shake.',
        parameters: {
          type: 'object',
          properties: {
            food: {
              type: 'string',
              description: "Only the food name, in the person's own words.",
            },
            meal: { type: 'string', enum: meals, description: 'The meal it is eaten in.' },
            day: {
              type: 'string',
              enum: ['today', 'yesterday', 'tomorrow'],
              description: 'The day it is eaten.',
            },
          },
          required: [],
        },
      },
      {
        name: 'copy_meal',
        description:
          'Copy food that was ALREADY logged on an EARLIER day. Only when the person says same, again, repeat or copy and names a day.',
        parameters: {
          type: 'object',
          properties: {
            meal: { type: 'string', enum: meals, description: 'The meal it goes into.' },
            day: {
              type: 'string',
              enum: ['today', 'yesterday', 'tomorrow'],
              description: 'The day it goes into.',
            },
            from_meal: {
              type: 'string',
              enum: meals,
              description: 'The meal copied, only if different from meal.',
            },
            from_day: {
              type: 'string',
              enum: sourceDays,
              description: 'The day copied from.',
            },
          },
          required: [],
        },
      },
    ]);
  });

  it('gives the 1.2B text model one instruction instead of example turns on a first try', () => {
    expect(nativeVoiceMessages(TWO, undefined, 'text')).toEqual([
      {
        role: 'system',
        content:
          'Call a tool only when the sentence asks the app to log, copy, open or write something. Otherwise reply "Okay." and call no tool. A greeting, thanks or a question is not a request.',
      },
    ]);
  });

  it('gives the example turns to the 450M, and to the text model once a tool is picked', () => {
    expect(nativeVoiceMessages(TWO)).toEqual(nativeVoiceExamples(TWO));
    expect(nativeVoiceMessages(TWO, 'copy_meal', 'text')).toEqual(nativeVoiceExamples(TWO));
  });

  it('gives the text model its own copy_meal wording, with the same search_food and slot order', () => {
    const tools = buildNativeVoiceTools(TWO, undefined, 'text');
    const [search, copy] = tools as unknown as {
      name: string;
      description: string;
      parameters: { type: string; properties: Record<string, object>; required: string[] };
    }[];

    expect(search).toEqual(buildNativeVoiceTools(TWO)[0]);
    expect(copy.name).toBe('copy_meal');
    expect(copy.description).toBe(
      'Log the same meal as on an earlier day, such as "same as yesterday" or "repeat Friday\'s lunch". from_day is the day named.'
    );
    expect(copy.parameters.type).toBe('object');
    expect(copy.parameters.required).toEqual([]);
    expect(copy.parameters.properties).toEqual({
      meal: { type: 'string', enum: meals, description: 'The meal.' },
      from_day: {
        type: 'string',
        enum: sourceDays,
        description: 'The day named, such as yesterday or monday.',
      },
      from_meal: {
        type: 'string',
        enum: meals,
        description: 'Only for "as": the meal eaten before.',
      },
      day: {
        type: 'string',
        enum: ['today', 'yesterday', 'tomorrow'],
        description: 'Only for tomorrow.',
      },
    });
    expect(Object.keys(copy.parameters.properties)).toEqual([
      'meal',
      'from_day',
      'from_meal',
      'day',
    ]);
  });

  it('offers only the picked tool to the text model, with its own wording', () => {
    const tools = buildNativeVoiceTools(TWO, 'copy_meal', 'text');

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('copy_meal');
    expect(tools[0].description).toBe(
      'Log the same meal as on an earlier day, such as "same as yesterday" or "repeat Friday\'s lunch". from_day is the day named.'
    );
  });

  it('shows these example turns in this order', () => {
    expect(nativeVoiceExamples(TWO)).toEqual([
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
      { role: 'user', content: 'Today I had the same lunch as yesterday' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_2',
            name: 'copy_meal',
            arguments: '{"meal":"lunch","day":"today","from_day":"yesterday"}',
          },
        ],
      },
      { role: 'tool', toolCallId: 'call_2', content: 'ok' },
      { role: 'assistant', content: 'Done.' },
      { role: 'user', content: 'I had a banana' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call_3', name: 'search_food', arguments: '{"food":"banana"}' }],
      },
      { role: 'tool', toolCallId: 'call_3', content: 'ok' },
      { role: 'assistant', content: 'Done.' },
    ]);
  });

  it('keeps the measured tool order, with the tools added since in their own places', () => {
    expect(NATIVE_VOICE_TOOL_ORDER).toEqual([
      'search_food',
      'copy_meal',
      'log_weight',
      'log_meal',
      'add_note',
      'go_to',
      'ask_coach',
      'start_workout',
      'log_cardio',
      'open_camera',
    ]);
  });
});

describe('nativeVoiceExamples for a set with a non-food tool', () => {
  const OFFERED: readonly VoiceActionTool[] = ['search_food', 'log_weight'];

  it('answers the out-of-scope question with the app refusal, not the food one', () => {
    const preamble = nativeVoiceExamples(OFFERED).slice(0, 4);

    expect(preamble[3]).toEqual({ role: 'assistant', content: 'I can only do things in the app.' });
  });

  it('renumbers the call ids over only the offered tools, in example order', () => {
    const calls = nativeVoiceExamples(OFFERED).flatMap((message) => message.toolCalls ?? []);

    expect(calls.map((call) => call.id)).toEqual(['call_1', 'call_2']);
    expect(calls.map((call) => call.name)).toEqual(['log_weight', 'search_food']);
  });

  it('keeps the food refusal when every offered tool logs food', () => {
    expect(nativeVoiceExamples(['copy_meal']).slice(0, 4)[3]).toEqual({
      role: 'assistant',
      content: 'I can only log food.',
    });
  });
});

describe("the downloaded models' default set", () => {
  const offered = activeVoiceTools(DEFAULT_VOICE_TOOL_SELECTION, 3);

  it('is offered search first, with the weigh-in example shown first (measured as a set)', () => {
    expect(buildNativeVoiceTools(offered).map((tool) => tool.name)).toEqual([
      'search_food',
      'copy_meal',
      'log_weight',
    ]);
    expect(
      nativeVoiceExamples(offered)
        .filter((message) => message.role === 'user')
        .map((message) => message.content)
    ).toEqual([
      'Hi, my name is Anna',
      'What did I eat on Monday?',
      'My weight is 81.5',
      'Same breakfast as yesterday',
      'Today I had the same lunch as yesterday',
      'I had a banana',
    ]);
  });
});

describe('native placement guarantees', () => {
  it('places every action tool once in the offer order and once in the example order', () => {
    const offered = VOICE_ACTION_TOOLS.map((name) => VOICE_TOOLS[name].native.order).sort();
    const shown = VOICE_ACTION_TOOLS.map((name) => VOICE_TOOLS[name].native.examples.order).sort();

    expect(offered).toEqual(VOICE_ACTION_TOOLS.map((_, index) => index));
    expect(shown).toEqual(VOICE_ACTION_TOOLS.map((_, index) => index));
  });

  it('offers no non-action tool: none and cant_determine_tool answer in plain text by design', () => {
    expect(NATIVE_VOICE_TOOL_ORDER).not.toContain('none');
    expect(NATIVE_VOICE_TOOL_ORDER).not.toContain('cant_determine_tool');
  });
});

describe('first requests with the new native voice tools', () => {
  it('instructs the text model to start a workout when it is offered', () => {
    expect(
      nativeVoiceMessages(['log_cardio', 'start_workout'], undefined, 'text')[0].content
    ).toContain('log or start something');
  });

  it('makes a question actionable only while the coach is offered', () => {
    expect(nativeVoiceExamples(['ask_coach'])[2].content).toBe('I slept badly last night');
    expect(nativeVoiceExamples(['start_workout'])[2].content).toBe('What did I eat on Monday?');
    const instruction = nativeVoiceMessages(['ask_coach'], undefined, 'text')[0].content;
    expect(instruction).toContain('asks a question');
    expect(instruction).not.toContain('log, copy');
  });
});
