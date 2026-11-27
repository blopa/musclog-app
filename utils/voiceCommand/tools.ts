import {
  resolveAddNote,
  resolveCopyMeal,
  resolveGoTo,
  resolveLogMeal,
  resolveLogWeight,
  resolveSearchFood,
} from '@/utils/voiceCommand/resolve';
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
 * The tool registry: the one place a voice tool is described. The prompt is built from `promptLine`
 * and `promptExamples`, the tool picker and the settings from `titleKey` and `labelKey`, and
 * `resolve` turns the model's slots into an action.
 */

/** One example sentence and the call it should produce. */
export type VoiceExample = { say: string; arguments: string };

/**
 * What running a tool does. None writes anything: `navigate` only opens a screen, `prefill` opens
 * one with fields filled in, and `confirm` opens a sheet whose button saves.
 */
export type VoiceToolEffect = 'navigate' | 'prefill' | 'confirm';

export type VoiceToolDefinition = {
  effect: VoiceToolEffect;
  /** For the system prompt: what the tool does and which fields it reads. */
  promptLine: string;
  /** For the system prompt: sentences and the command each should produce. */
  promptExamples: readonly [said: string, command: string][];
  /** Whole translation key of the tool's name, where the person picks what they meant. */
  titleKey: string;
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
    /** The model writes "other" as filler when no meal was said: it is read as no meal. */
    dropsOtherMeal?: boolean;
    /** Only about food, so the example turns may say that food is all the model does. */
    logsFood?: boolean;
  };
  resolve: (command: VoiceCommand, context: VoiceResolveContext) => VoiceResolution;
};

export const VOICE_TOOLS: Record<VoiceActionTool, VoiceToolDefinition> = {
  copy_meal: {
    effect: 'prefill',
    promptLine:
      'copy_meal: log again food eaten on another day ("same as yesterday"). meal and day = where it goes, from_meal (only if different) and from_day = what is copied. No meal: the whole day.',
    promptExamples: [
      [
        'I just had breakfast, same as yesterday',
        '{"tool":"copy_meal","meal":"breakfast","from_day":"yesterday"}',
      ],
      [
        "Log Monday's lunch as dinner",
        '{"tool":"copy_meal","meal":"dinner","from_meal":"lunch","from_day":"monday"}',
      ],
    ],
    titleKey: 'voiceInput.command.tool.copyMeal',
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
      logsFood: true,
      examples: {
        order: 1,
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
    effect: 'prefill',
    promptLine:
      'search_food: find one food to log. food = only the food name, meal, day = when it is eaten.',
    promptExamples: [
      [
        'Search Greek yogurt for lunch',
        '{"tool":"search_food","food":"Greek yogurt","meal":"lunch"}',
      ],
      ['I had a banana', '{"tool":"search_food","food":"banana"}'],
    ],
    titleKey: 'voiceInput.command.tool.searchFood',
    labelKey: 'voiceInput.command.capability.searchFood',
    native: {
      description: 'Log one food the person names, such as banana, eggs or a protein shake.',
      slots: {
        food: "Only the food name, in the person's own words.",
        meal: 'The meal it is eaten in.',
        day: 'The day it is eaten.',
      },
      order: 0,
      logsFood: true,
      dropsOtherMeal: true,
      examples: { order: 2, turns: [{ say: 'I had a banana', arguments: '{"food":"banana"}' }] },
    },
    resolve: resolveSearchFood,
  },
  log_weight: {
    effect: 'confirm',
    promptLine: 'log_weight: record the body weight said. weight = the number, day.',
    promptExamples: [['I weigh 82.4 kilos', '{"tool":"log_weight","weight":"82.4"}']],
    titleKey: 'voiceInput.command.tool.logWeight',
    labelKey: 'voiceInput.command.capability.logWeight',
    native: {
      description: 'Record the body weight the person says they weigh now.',
      slots: {
        weight: 'The number said, digits only.',
        day: 'The day of the weigh-in.',
      },
      order: 2,
      examples: {
        order: 0,
        turns: [{ say: 'My weight is 81.5', arguments: '{"weight":"81.5"}' }],
      },
    },
    resolve: resolveLogWeight,
  },
  log_meal: {
    effect: 'prefill',
    promptLine:
      'log_meal: log a meal of several foods or with amounts ("two eggs and toast"). meal, day.',
    promptExamples: [
      ['I had two eggs and toast for breakfast', '{"tool":"log_meal","meal":"breakfast"}'],
    ],
    titleKey: 'voiceInput.command.tool.logMeal',
    labelKey: 'voiceInput.command.capability.logMeal',
    native: {
      description:
        'Log a meal of several foods, or foods with amounts, such as two eggs and toast.',
      slots: {
        meal: 'The meal it is eaten in.',
        day: 'The day it is eaten.',
      },
      order: 3,
      logsFood: true,
      dropsOtherMeal: true,
      examples: {
        order: 3,
        turns: [
          { say: 'For lunch I ate rice, chicken and a salad', arguments: '{"meal":"lunch"}' },
        ],
      },
    },
    resolve: resolveLogMeal,
  },
  add_note: {
    effect: 'prefill',
    promptLine: 'add_note: write down a note. text = the words of the note.',
    promptExamples: [
      ['Note that my knee hurt today', '{"tool":"add_note","text":"my knee hurt today"}'],
    ],
    titleKey: 'voiceInput.command.tool.addNote',
    labelKey: 'voiceInput.command.capability.addNote',
    native: {
      description: 'Write down a note, when the person says note, remember or write down.',
      slots: { text: 'The words of the note.' },
      order: 4,
      examples: {
        order: 4,
        turns: [{ say: 'Take a note: buy more oats', arguments: '{"text":"buy more oats"}' }],
      },
    },
    resolve: resolveAddNote,
  },
  go_to: {
    effect: 'navigate',
    promptLine:
      'go_to: open a screen of the app. screen = which one (checkin is the weekly review).',
    promptExamples: [['Open my weekly review', '{"tool":"go_to","screen":"checkin"}']],
    titleKey: 'voiceInput.command.tool.goTo',
    labelKey: 'voiceInput.command.capability.goTo',
    native: {
      description: 'Open a screen of the app, when the person asks to see, show or open it.',
      slots: { screen: 'The screen to open. checkin is the weekly review.' },
      order: 5,
      examples: {
        order: 5,
        turns: [{ say: 'Show me my progress', arguments: '{"screen":"progress"}' }],
      },
    },
    resolve: resolveGoTo,
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
      'cant_determine_tool: a request that fits no tool, could be several, or does not say what it refers to. Never guess.',
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
