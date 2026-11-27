import type { StructuredDialect } from '@/utils/structuredDialect';
import {
  MAX_VOICE_COMMANDS,
  VOICE_DAYS,
  VOICE_MEALS,
  VOICE_SOURCE_DAYS,
  VOICE_TOOL_NAMES,
  type VoiceToolName,
} from '@/utils/voiceCommand/types';

/**
 * The schema of a voice reply, per provider dialect. Every command is one flat object whose slots
 * are optional: the local shape check and `makeSchemaStrict` cannot follow a union, so a new tool
 * adds a slot here only when none of these fits.
 */

type Slot = { choices?: readonly string[]; description: string };

export const SLOTS = {
  meal: { choices: VOICE_MEALS, description: 'The meal it goes into.' },
  day: { choices: VOICE_DAYS, description: 'The day it happens on.' },
  from_meal: { choices: VOICE_MEALS, description: 'copy_meal: the meal copied.' },
  from_day: { choices: VOICE_SOURCE_DAYS, description: 'copy_meal: the day copied from.' },
  food: { description: 'search_food: the food name only.' },
} as const satisfies Record<string, Slot>;

export type VoiceSlotKey = keyof typeof SLOTS;

const SLOT_KEYS = Object.keys(SLOTS) as VoiceSlotKey[];

/** A slot nobody spoke about: required-but-null for strict OpenAI, nullable for Gemini, else absent. */
function slotProperty(slot: Slot, dialect: StructuredDialect): Record<string, unknown> {
  const { choices, description } = slot;
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

/** `only`: the person picked the tool, so it is the one choice the schema allows. */
export function buildVoiceCommandSchema(dialect: StructuredDialect, only?: VoiceToolName): object {
  const strict = dialect === 'openai';
  const properties = {
    tool: {
      type: 'string',
      enum: only ? [only] : [...VOICE_TOOL_NAMES],
      description: 'The tool to run.',
    },
    ...Object.fromEntries(SLOT_KEYS.map((key) => [key, slotProperty(SLOTS[key], dialect)])),
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
          required: strict ? ['tool', ...SLOT_KEYS] : ['tool'],
          ...(dialect === 'gemini' ? { propertyOrdering: ['tool', ...SLOT_KEYS] } : {}),
          ...(strict ? { additionalProperties: false } : {}),
        },
      },
    },
    required: ['commands'],
    ...(strict ? { additionalProperties: false } : {}),
  };
}
