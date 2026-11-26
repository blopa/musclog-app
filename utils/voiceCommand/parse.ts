import { isRecord } from '@/utils/isRecord';
import {
  MAX_VOICE_COMMANDS,
  MAX_VOICE_FOOD_CHARS,
  VOICE_DAYS,
  VOICE_MEALS,
  VOICE_SOURCE_DAYS,
  VOICE_TOOL_NAMES,
  type VoiceCommand,
} from '@/utils/voiceCommand/types';

function oneOf<T extends string>(value: unknown, choices: readonly T[]): T | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return choices.find((choice) => choice === normalized) ?? null;
}

function foodText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim().slice(0, MAX_VOICE_FOOD_CHARS).trim();

  // A small model sometimes writes the word where it means no value.
  return !text || text.toLowerCase() === 'null' ? null : text;
}

function parseCommand(value: unknown): VoiceCommand | null {
  if (!isRecord(value)) {
    return null;
  }

  const tool = oneOf(value.tool, VOICE_TOOL_NAMES);
  if (!tool) {
    return null;
  }

  return {
    tool,
    meal: oneOf(value.meal, VOICE_MEALS),
    day: oneOf(value.day, VOICE_DAYS),
    fromMeal: oneOf(value.from_meal, VOICE_MEALS),
    fromDay: oneOf(value.from_day, VOICE_SOURCE_DAYS),
    food: foodText(value.food),
  };
}

/**
 * Reads a model's reply leniently: an unknown tool is dropped and a bad slot becomes `null`.
 * Returns `null` when the reply has no command list at all, and an empty list when none is usable.
 */
export function parseVoiceCommands(raw: unknown): VoiceCommand[] | null {
  if (!isRecord(raw)) {
    return null;
  }

  // A server that does not enforce the schema may answer with the bare command.
  const bare = 'tool' in raw ? [raw] : null;
  const list = Array.isArray(raw.commands) ? raw.commands : bare;
  if (!list) {
    return null;
  }

  return list
    .map(parseCommand)
    .filter((command): command is VoiceCommand => command !== null)
    .slice(0, MAX_VOICE_COMMANDS);
}
