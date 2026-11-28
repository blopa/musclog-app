import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';
import { VOICE_ACTION_TOOLS, type VoiceActionTool } from '@/utils/voiceCommand/types';

/**
 * Which voice tools a person chose, and which of them a request offers. The choice is stored as
 * picked and never cut on write: the model in use only decides how many of the first picks count,
 * so switching model or restoring a backup loses nothing. Pure.
 */

/**
 * What is offered before anyone chooses, most useful first (the first ones fit a small model). The
 * first six are the order the downloaded models were measured with: append a tool, never insert one.
 */
export const DEFAULT_VOICE_TOOL_SELECTION: readonly VoiceActionTool[] = [
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
];

/** What the phone and the AI in use can run. */
export type VoiceToolContext = {
  /** False on a device without a camera, where the tools that open it are never offered. */
  hasCamera: boolean;
  /** The downloaded model, which is never offered a tool it was measured to route badly. */
  nativeModel: boolean;
};

/** Whether this device has what the tool needs. */
export function isVoiceToolOnDevice(tool: VoiceActionTool, hasCamera: boolean): boolean {
  return hasCamera || !VOICE_TOOLS[tool].needsCamera;
}

/** Whether the AI in use is ever offered the tool. */
export function isVoiceToolSupported(tool: VoiceActionTool, nativeModel: boolean): boolean {
  return !(nativeModel && VOICE_TOOLS[tool].native.unsupported);
}

/** Whether a request may offer the tool at all. */
export function canOfferVoiceTool(
  tool: VoiceActionTool,
  { hasCamera, nativeModel }: VoiceToolContext
): boolean {
  return isVoiceToolOnDevice(tool, hasCamera) && isVoiceToolSupported(tool, nativeModel);
}

function isTool(value: string): value is VoiceActionTool {
  return VOICE_ACTION_TOOLS.some((tool) => tool === value);
}

/** The stored comma-separated list, in pick order; anything unusable is the default. */
export function parseVoiceToolSelection(raw: string | null | undefined): VoiceActionTool[] {
  const picked = [...new Set((raw ?? '').split(',').map((name) => name.trim()))].filter(isTool);

  return picked.length > 0 ? picked : [...DEFAULT_VOICE_TOOL_SELECTION];
}

export function serializeVoiceToolSelection(selection: readonly VoiceActionTool[]): string {
  return selection.join(',');
}

const everyTool = () => true;

/**
 * Adds a tool at the end or removes it. Returns the same array when removing would leave no tool
 * that can be offered here (`available`), so a caller can tell nothing changed.
 */
export function toggleVoiceTool(
  selection: readonly VoiceActionTool[],
  tool: VoiceActionTool,
  available: (tool: VoiceActionTool) => boolean = everyTool
): readonly VoiceActionTool[] {
  if (!selection.includes(tool)) {
    return [...selection, tool];
  }

  const rest = selection.filter((name) => name !== tool);

  return rest.some(available) ? rest : selection;
}

/**
 * The first `max` picks that can be offered (all of them without a limit), in the order a model is
 * offered them. A tool that cannot be offered here never takes one of the places. A choice made on
 * another phone can hold nothing this one can offer: the default is offered then.
 */
export function activeVoiceTools(
  selection: readonly VoiceActionTool[],
  max?: number,
  available: (tool: VoiceActionTool) => boolean = everyTool
): VoiceActionTool[] {
  const picked = selection.filter(available);
  const usable = picked.length > 0 ? picked : DEFAULT_VOICE_TOOL_SELECTION.filter(available);

  return usable
    .slice(0, max ?? usable.length)
    .sort((a, b) => VOICE_TOOLS[a].native.order - VOICE_TOOLS[b].native.order);
}
