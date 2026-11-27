import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';
import { VOICE_ACTION_TOOLS, type VoiceActionTool } from '@/utils/voiceCommand/types';

/**
 * Which voice tools a person chose, and which of them a request offers. The choice is stored as
 * picked and never cut on write: the model in use only decides how many of the first picks count,
 * so switching model or restoring a backup loses nothing. Pure.
 */

/** What is offered before anyone chooses, most useful first (the first ones fit a small model). */
export const DEFAULT_VOICE_TOOL_SELECTION: readonly VoiceActionTool[] = [
  'search_food',
  'copy_meal',
  'log_weight',
  'log_meal',
  'add_note',
  'go_to',
];

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

/**
 * Adds a tool at the end or removes it. Returns the same array when removing would leave none, so
 * a caller can tell nothing changed.
 */
export function toggleVoiceTool(
  selection: readonly VoiceActionTool[],
  tool: VoiceActionTool
): readonly VoiceActionTool[] {
  if (!selection.includes(tool)) {
    return [...selection, tool];
  }

  return selection.length === 1 ? selection : selection.filter((name) => name !== tool);
}

/** The first `max` picks (all of them without a limit), in the order a model is offered them. */
export function activeVoiceTools(
  selection: readonly VoiceActionTool[],
  max?: number
): VoiceActionTool[] {
  return selection
    .slice(0, max ?? selection.length)
    .sort((a, b) => VOICE_TOOLS[a].native.order - VOICE_TOOLS[b].native.order);
}
