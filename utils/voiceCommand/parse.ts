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

const ABSENT = Symbol('absent');

/** A slot nobody filled: missing, null, blank, or the word "null" a small model writes for none. */
function isAbsent(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && (!value.trim() || value.trim().toLowerCase() === 'null'))
  );
}

/** `ABSENT` for an unfilled slot, the choice for a valid one, `null` for any other value. */
function slot<T extends string>(value: unknown, choices: readonly T[]): T | typeof ABSENT | null {
  return isAbsent(value) ? ABSENT : oneOf(value, choices);
}

function parseCommand(value: unknown): VoiceCommand | null {
  if (!isRecord(value)) {
    return null;
  }

  const tool = oneOf(value.tool, VOICE_TOOL_NAMES);
  if (!tool) {
    return null;
  }

  const meal = slot(value.meal, VOICE_MEALS);
  const day = slot(value.day, VOICE_DAYS);
  const fromMeal = slot(value.from_meal, VOICE_MEALS);
  const fromDay = slot(value.from_day, VOICE_SOURCE_DAYS);
  // A value that is present but outside its choices makes the command unusable.
  if (meal === null || day === null || fromMeal === null || fromDay === null) {
    return null;
  }

  let food: string | null = null;
  if (!isAbsent(value.food)) {
    if (typeof value.food !== 'string') {
      return null;
    }

    food = value.food.trim().slice(0, MAX_VOICE_FOOD_CHARS).trim() || null;
  }

  return {
    tool,
    meal: meal === ABSENT ? null : meal,
    day: day === ABSENT ? null : day,
    fromMeal: fromMeal === ABSENT ? null : fromMeal,
    fromDay: fromDay === ABSENT ? null : fromDay,
    food,
  };
}

/**
 * Reads a model's reply: an unknown tool is dropped, and so is a command with a slot value outside
 * its choices (a small model writes filler such as `from_day: "tomorrow"` when it has nothing to
 * put there, and reading it as "not said" turned it into an action). An unfilled slot is `null`.
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
