import { buildVoiceCommandSchema } from '@/utils/voiceCommand/schema';
import { VOICE_TOOL_NAMES, type VoiceActionTool } from '@/utils/voiceCommand/types';
import type { StructuredDialect } from '@/utils/structuredDialect';

const DIALECTS: StructuredDialect[] = ['openai', 'gemini', 'claude', 'on-device', 'gguf'];
const TWO: VoiceActionTool[] = ['search_food', 'copy_meal'];
const SLOT_KEYS = ['meal', 'day', 'from_meal', 'from_day', 'food'];

type Shape = {
  properties: {
    commands: {
      maxItems?: number;
      items: {
        required: string[];
        additionalProperties?: boolean;
        propertyOrdering?: string[];
        properties: Record<string, Record<string, unknown>>;
      };
    };
  };
  additionalProperties?: boolean;
};

function schemaFor(
  dialect: StructuredDialect,
  offered?: VoiceActionTool[],
  chosen?: VoiceActionTool
): Shape {
  return buildVoiceCommandSchema(dialect, offered, chosen) as Shape;
}

describe('buildVoiceCommandSchema', () => {
  it.each(DIALECTS)('lists every tool name for %s', (dialect) => {
    const items = schemaFor(dialect).properties.commands.items;

    expect(items.properties.tool.enum).toEqual(expect.arrayContaining([...VOICE_TOOL_NAMES]));
  });

  it('builds the strict OpenAI shape', () => {
    const schema = schemaFor('openai', TWO);
    const items = schema.properties.commands.items;

    expect(items.required).toEqual(['tool', ...SLOT_KEYS]);
    expect(items.additionalProperties).toBe(false);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.commands.maxItems).toBeUndefined();
    expect(items.properties.meal.type).toEqual(['string', 'null']);
    expect(items.properties.meal.enum).toContain(null);
  });

  it('includes only the slots the offered tools use', () => {
    expect(Object.keys(schemaFor('gguf', TWO).properties.commands.items.properties).sort()).toEqual(
      ['day', 'food', 'from_day', 'from_meal', 'meal', 'tool'].sort()
    );
    expect(
      Object.keys(schemaFor('gguf', ['search_food']).properties.commands.items.properties).sort()
    ).toEqual(['day', 'food', 'meal', 'tool'].sort());
  });

  it('adds the screen slot when go_to is offered', () => {
    const items = schemaFor('openai', [...TWO, 'go_to']).properties.commands.items;

    expect(items.properties.screen).toBeDefined();
    expect(items.required).toEqual(['tool', ...SLOT_KEYS, 'screen']);
  });

  it('names only the chosen tool when one is picked', () => {
    const items = schemaFor('gemini', TWO, 'copy_meal').properties.commands.items;

    expect(items.properties.tool.enum).toEqual(['copy_meal']);
  });

  it('builds the Gemini shape with nullable slots, ordering and a one-item limit', () => {
    const schema = schemaFor('gemini', TWO);
    const items = schema.properties.commands.items;

    expect(items.properties.meal.nullable).toBe(true);
    expect(items.propertyOrdering?.[0]).toBe('tool');
    expect(schema.properties.commands.maxItems).toBe(1);
  });

  it.each(['claude', 'on-device'] as const)(
    'builds the %s shape with only tool required',
    (dialect) => {
      const schema = schemaFor(dialect, TWO);

      expect(schema.properties.commands.items.required).toEqual(['tool']);
      expect(schema.properties.commands.maxItems).toBeUndefined();
    }
  );

  it('limits the gguf list to one command', () => {
    expect(schemaFor('gguf', TWO).properties.commands.maxItems).toBe(1);
  });
});
