import type { StructuredDialect } from '@/utils/structuredDialect';
import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';
import {
  MAX_VOICE_COMMANDS,
  MAX_VOICE_FOOD_CHARS,
  MAX_VOICE_NOTE_CHARS,
  MAX_VOICE_WEIGHT_CHARS,
  VOICE_ACTION_TOOLS,
  VOICE_DAYS,
  VOICE_MEALS,
  VOICE_NON_ACTION_TOOLS,
  VOICE_SCREENS,
  VOICE_SOURCE_DAYS,
  type VoiceActionTool,
  type VoiceCommand,
} from '@/utils/voiceCommand/types';

/**
 * The schema of a voice reply, per provider dialect. Every command is one flat object whose slots
 * are optional: the local shape check and `makeSchemaStrict` cannot follow a union, so a new tool
 * adds a slot here only when none of these fits.
 */

/** The fields of a parsed command that hold what a slot said. */
type CommandField = Exclude<keyof VoiceCommand, 'tool'>;

/**
 * One slot: the command field it fills, and how its value is read. `choices`: one of a list.
 * `text`: the person's own words, cut at `maxChars`. `number`: digits, which a model that does not
 * follow the string type may write as a JSON number.
 */
type Slot = { field: CommandField; description: string } & (
  | { kind: 'choice'; choices: readonly string[] }
  | { kind: 'text'; maxChars: number }
  | { kind: 'number'; maxChars: number }
);

export const SLOTS = {
  meal: {
    field: 'meal',
    kind: 'choice',
    choices: VOICE_MEALS,
    description: 'The meal it goes into.',
  },
  day: { field: 'day', kind: 'choice', choices: VOICE_DAYS, description: 'The day it happens on.' },
  from_meal: {
    field: 'fromMeal',
    kind: 'choice',
    choices: VOICE_MEALS,
    description: 'copy_meal: the meal copied.',
  },
  from_day: {
    field: 'fromDay',
    kind: 'choice',
    choices: VOICE_SOURCE_DAYS,
    description: 'copy_meal: the day copied from.',
  },
  food: {
    field: 'food',
    kind: 'text',
    maxChars: MAX_VOICE_FOOD_CHARS,
    description: 'search_food: the food name only.',
  },
  weight: {
    field: 'weight',
    kind: 'number',
    maxChars: MAX_VOICE_WEIGHT_CHARS,
    description: 'log_weight: the body weight said, digits only.',
  },
  text: {
    field: 'text',
    kind: 'text',
    maxChars: MAX_VOICE_NOTE_CHARS,
    description: 'add_note: the words of the note.',
  },
  screen: {
    field: 'screen',
    kind: 'choice',
    choices: VOICE_SCREENS,
    description: 'go_to: the screen to open.',
  },
} as const satisfies Record<string, Slot>;

export type VoiceSlotKey = keyof typeof SLOTS;

export const SLOT_KEYS = Object.keys(SLOTS) as VoiceSlotKey[];

/** The values a slot may take, or null for a free one. */
export function slotChoices(key: VoiceSlotKey): readonly string[] | null {
  const slot: Slot = SLOTS[key];

  return slot.kind === 'choice' ? slot.choices : null;
}

/** A slot nobody spoke about: required-but-null for strict OpenAI, nullable for Gemini, else absent. */
function slotProperty(key: VoiceSlotKey, dialect: StructuredDialect): Record<string, unknown> {
  const { description } = SLOTS[key];
  const choices = slotChoices(key);
  switch (dialect) {
    case 'openai':
      return {
        type: ['string', 'null'],
        ...(choices ? { enum: [...choices, null] } : {}),
        description,
      };
    case 'gemini':
      return {
        type: 'string',
        nullable: true,
        ...(choices ? { enum: [...choices] } : {}),
        description,
      };
    case 'claude':
    case 'on-device':
    case 'gguf':
      return { type: 'string', ...(choices ? { enum: [...choices] } : {}), description };
  }
}

/**
 * The schema for the offered tools: their names (and the two non-actions), and only the slots they
 * read. `chosen`: the person picked the tool, so it is the one name the schema allows.
 */
export function buildVoiceCommandSchema(
  dialect: StructuredDialect,
  offered: readonly VoiceActionTool[] = VOICE_ACTION_TOOLS,
  chosen?: VoiceActionTool
): object {
  const strict = dialect === 'openai';
  const used = new Set(offered.flatMap((tool) => Object.keys(VOICE_TOOLS[tool].native.slots)));
  const slotKeys = SLOT_KEYS.filter((key) => used.has(key));
  const properties = {
    tool: {
      type: 'string',
      enum: chosen
        ? [chosen]
        : [
            ...VOICE_ACTION_TOOLS.filter((tool) => offered.includes(tool)),
            ...VOICE_NON_ACTION_TOOLS,
          ],
      description: 'The tool to run.',
    },
    ...Object.fromEntries(slotKeys.map((key) => [key, slotProperty(key, dialect)])),
  };
  // OpenAI strict mode and Claude reject array length limits; the parser caps the list anyway.
  const limitsLength = dialect === 'gemini' || dialect === 'gguf';

  return {
    type: 'object',
    properties: {
      commands: {
        type: 'array',
        ...(limitsLength ? { maxItems: MAX_VOICE_COMMANDS } : {}),
        items: {
          type: 'object',
          properties,
          required: strict ? ['tool', ...slotKeys] : ['tool'],
          ...(dialect === 'gemini' ? { propertyOrdering: ['tool', ...slotKeys] } : {}),
          ...(strict ? { additionalProperties: false } : {}),
        },
      },
    },
    required: ['commands'],
    ...(strict ? { additionalProperties: false } : {}),
  };
}
