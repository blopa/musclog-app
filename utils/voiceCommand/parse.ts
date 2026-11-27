import { isRecord } from '@/utils/isRecord';
import { SLOT_KEYS, slotChoices, SLOTS, type VoiceSlotKey } from '@/utils/voiceCommand/schema';
import {
  MAX_VOICE_COMMANDS,
  VOICE_TOOL_NAMES,
  type VoiceActionTool,
  type VoiceCommand,
  type VoiceToolName,
} from '@/utils/voiceCommand/types';

function oneOf<T extends string>(value: unknown, choices: readonly T[]): T | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return choices.find((choice) => choice === normalized) ?? null;
}

/** A slot nobody filled: missing, null, blank, or the word "null" a small model writes for none. */
function isAbsent(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && (!value.trim() || value.trim().toLowerCase() === 'null'))
  );
}

/** A filled slot's value as its kind reads it, or null for a value it cannot take. */
function slotValue(key: VoiceSlotKey, value: unknown): string | null {
  const slot = SLOTS[key];
  if (slot.kind === 'choice') {
    return oneOf(value, slotChoices(key) ?? []);
  }

  if (slot.kind === 'number' && typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  return value.trim().slice(0, slot.maxChars).trim() || null;
}

/** Every slot unfilled. */
function emptyCommand(tool: VoiceToolName): VoiceCommand {
  return {
    tool,
    meal: null,
    day: null,
    fromMeal: null,
    fromDay: null,
    food: null,
    weight: null,
    text: null,
    screen: null,
  };
}

/** A command with the slots that can be read; `strict` drops it for any value that cannot. */
function readSlots(
  tool: VoiceToolName,
  value: Record<string, unknown>,
  strict: boolean
): VoiceCommand | null {
  const filled: Record<string, string> = {};
  for (const key of SLOT_KEYS) {
    if (isAbsent(value[key])) {
      continue;
    }

    const read = slotValue(key, value[key]);
    if (read !== null) {
      filled[SLOTS[key].field] = read;
    } else if (strict) {
      return null;
    }
  }

  // Each field was read by its own slot, so its value is one the field takes.
  return { ...emptyCommand(tool), ...(filled as Partial<VoiceCommand>) };
}

function parseCommand(value: unknown): VoiceCommand | null {
  if (!isRecord(value)) {
    return null;
  }

  const tool = oneOf(value.tool, VOICE_TOOL_NAMES);

  return tool ? readSlots(tool, value, true) : null;
}

function isOffered(tool: VoiceToolName, offered: readonly VoiceActionTool[]): boolean {
  return tool === 'none' || tool === 'cant_determine_tool' || offered.some((name) => name === tool);
}

/**
 * Reads a model's reply: an unknown tool is dropped, and so is a command with a slot value outside
 * its choices (a small model writes filler such as `from_day: "tomorrow"` when it has nothing to
 * put there, and reading it as "not said" turned it into an action). An unfilled slot is `null`.
 * A tool that was not in `offered` runs nothing: the person is asked which one they meant.
 * Returns `null` when the reply has no command list at all, and an empty list when none is usable.
 */
export function parseVoiceCommands(
  raw: unknown,
  offered?: readonly VoiceActionTool[]
): VoiceCommand[] | null {
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
    .map((command) =>
      !offered || isOffered(command.tool, offered) ? command : emptyCommand('cant_determine_tool')
    )
    .slice(0, MAX_VOICE_COMMANDS);
}

/**
 * The reply to a request whose tool the person picked. Never fails: whatever tool the model names,
 * it is the picked one, and each slot it cannot read is simply unfilled. The person confirms on the
 * screen that opens, so a filler value must not cost them the whole command here.
 */
export function parseChosenCommand(raw: unknown, tool: VoiceActionTool): VoiceCommand {
  const list = isRecord(raw) && Array.isArray(raw.commands) ? raw.commands : [raw];
  const value: Record<string, unknown> = isRecord(list[0]) ? list[0] : {};

  return readSlots(tool, value, false) ?? emptyCommand(tool);
}
