import { resolveCopyMeal, resolveSearchFood } from '@/utils/voiceCommand/resolve';
import type {
  VoiceActionTool,
  VoiceCommand,
  VoiceNonActionTool,
  VoiceRejection,
  VoiceResolution,
} from '@/utils/voiceCommand/types';

/**
 * The tool registry: the one place a voice tool is described. The prompt is built from `promptLine`,
 * the "what you can say" list from `labelKey`, and `resolve` turns the model's slots into an action.
 */

export type VoiceToolDefinition = {
  /** For the system prompt: what the tool does and which fields it reads. */
  promptLine: string;
  /** Whole translation key of an example of what to say. */
  labelKey: string;
  resolve: (command: VoiceCommand, now: Date) => VoiceResolution;
};

export const VOICE_TOOLS: Record<VoiceActionTool, VoiceToolDefinition> = {
  copy_meal: {
    promptLine:
      'copy_meal: log again food eaten on another day ("same as yesterday", "repeat Monday\'s lunch"). meal = the meal it goes into, day = the day it goes into, from_meal = the meal copied (only if different from meal), from_day = the day copied from. No meal means the whole day.',
    labelKey: 'voiceInput.command.capability.copyMeal',
    resolve: resolveCopyMeal,
  },
  search_food: {
    promptLine:
      'search_food: find a specific food to log. food = only the food name, meal = the meal, day = the day it is eaten.',
    labelKey: 'voiceInput.command.capability.searchFood',
    resolve: resolveSearchFood,
  },
};

export const VOICE_NON_ACTIONS: Record<
  VoiceNonActionTool,
  { promptLine: string; reason: VoiceRejection }
> = {
  none: {
    promptLine:
      'none: not a request to do something: a question, a negation ("don\'t..."), a habit ("I usually...") or small talk.',
    reason: 'noAction',
  },
  cant_determine_tool: {
    promptLine:
      'cant_determine_tool: a request to do something that fits no tool, could be either tool, or does not say what it refers to. Never guess.',
    reason: 'cantDetermine',
  },
};

/** What a parsed command does at `now`. */
export function resolveVoiceCommand(command: VoiceCommand, now: Date): VoiceResolution {
  if (command.tool === 'none' || command.tool === 'cant_determine_tool') {
    return { ok: false, reason: VOICE_NON_ACTIONS[command.tool].reason };
  }

  return VOICE_TOOLS[command.tool].resolve(command, now);
}
