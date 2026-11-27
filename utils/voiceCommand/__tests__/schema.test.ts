import { buildVoiceCommandSchema } from '@/utils/voiceCommand/schema';
import { VOICE_TOOL_NAMES } from '@/utils/voiceCommand/types';
import type { StructuredDialect } from '@/utils/structuredDialect';

const DIALECTS: StructuredDialect[] = ['openai', 'gemini', 'claude', 'on-device', 'gguf'];
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

function schemaFor(dialect: StructuredDialect): Shape {
  return buildVoiceCommandSchema(dialect) as Shape;
}

describe('buildVoiceCommandSchema', () => {
  it.each(DIALECTS)('lists every tool name for %s', (dialect) => {
    const items = schemaFor(dialect).properties.commands.items;

    expect(items.properties.tool.enum).toEqual(expect.arrayContaining([...VOICE_TOOL_NAMES]));
  });

  it('builds the strict OpenAI shape', () => {
    const schema = schemaFor('openai');
    const items = schema.properties.commands.items;

    expect(items.required).toEqual(['tool', ...SLOT_KEYS]);
    expect(items.additionalProperties).toBe(false);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.commands.maxItems).toBeUndefined();
    expect(items.properties.meal.type).toEqual(['string', 'null']);
    expect(items.properties.meal.enum).toContain(null);
  });

  it('builds the Gemini shape with nullable slots, ordering and a one-item limit', () => {
    const schema = schemaFor('gemini');
    const items = schema.properties.commands.items;

    expect(items.properties.meal.nullable).toBe(true);
    expect(items.propertyOrdering?.[0]).toBe('tool');
    expect(schema.properties.commands.maxItems).toBe(1);
  });

  it.each(['claude', 'on-device'] as const)(
    'builds the %s shape with only tool required',
    (dialect) => {
      const schema = schemaFor(dialect);

      expect(schema.properties.commands.items.required).toEqual(['tool']);
      expect(schema.properties.commands.maxItems).toBeUndefined();
    }
  );

  it('limits the gguf list to one command', () => {
    expect(schemaFor('gguf').properties.commands.maxItems).toBe(1);
  });
});
