import { resolveCopyMeal, resolveSearchFood } from '@/utils/voiceCommand/resolve';
import type { VoiceSlotKey } from '@/utils/voiceCommand/schema';
import type {
  VoiceActionTool,
  VoiceCommand,
  VoiceNonActionTool,
  VoiceRejection,
  VoiceResolution,
  VoiceResolveContext,
} from '@/utils/voiceCommand/types';

/**
 * The tool registry: the one place a voice tool is described. The prompt is built from `promptLine`,
 * the "what you can say" list from `labelKey`, and `resolve` turns the model's slots into an action.
 */

/** One example sentence and the call it should produce. */
export type VoiceExample = { say: string; arguments: string };

export type VoiceToolDefinition = {
  /** For the system prompt: what the tool does and which fields it reads. */
  promptLine: string;
  /** Whole translation key of an example of what to say. */
  labelKey: string;
  /**
   * The model's own tool-call format (the downloaded model). Measured as a set: `order` is the
   * place the tool is offered in, `examples` the turns it is shown by (`order` among the tools).
   * Slots are in the order the model is shown them.
   */
  native: {
    description: string;
    slots: Partial<Record<VoiceSlotKey, string>>;
    order: number;
    examples: { order: number; turns: readonly VoiceExample[] };
  };
  resolve: (command: VoiceCommand, context: VoiceResolveContext) => VoiceResolution;
};

export const VOICE_TOOLS: Record<VoiceActionTool, VoiceToolDefinition> = {
  copy_meal: {
    promptLine:
      'copy_meal: log again food eaten on another day ("same as yesterday", "repeat Monday\'s lunch"). meal = the meal it goes into, day = the day it goes into, from_meal = the meal copied (only if different from meal), from_day = the day copied from. No meal means the whole day.',
    labelKey: 'voiceInput.command.capability.copyMeal',
    native: {
      description:
        'Copy food that was ALREADY logged on an EARLIER day. Only when the person says same, again, repeat or copy and names a day.',
      slots: {
        meal: 'The meal it goes into.',
        day: 'The day it goes into.',
        from_meal: 'The meal copied, only if different from meal.',
        from_day: 'The day copied from.',
      },
      order: 1,
      examples: {
        order: 0,
        turns: [
          {
            say: 'Same breakfast as yesterday',
            arguments: '{"meal":"breakfast","from_day":"yesterday"}',
          },
          {
            say: 'Today I had the same lunch as yesterday',
            arguments: '{"meal":"lunch","day":"today","from_day":"yesterday"}',
          },
        ],
      },
    },
    resolve: resolveCopyMeal,
  },
  search_food: {
    promptLine:
      'search_food: find a specific food to log. food = only the food name, meal = the meal, day = the day it is eaten.',
    labelKey: 'voiceInput.command.capability.searchFood',
    native: {
      description: 'Log one food the person names, such as banana, eggs or a protein shake.',
      slots: {
        food: "Only the food name, in the person's own words.",
        meal: 'The meal it is eaten in.',
        day: 'The day it is eaten.',
      },
      order: 0,
      examples: { order: 1, turns: [{ say: 'I had a banana', arguments: '{"food":"banana"}' }] },
    },
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

/** What a parsed command does at `context.now`, given what the person said. */
export function resolveVoiceCommand(
  command: VoiceCommand,
  context: VoiceResolveContext
): VoiceResolution {
  if (command.tool === 'none' || command.tool === 'cant_determine_tool') {
    return { ok: false, reason: VOICE_NON_ACTIONS[command.tool].reason };
  }

  return VOICE_TOOLS[command.tool].resolve(command, context);
}
