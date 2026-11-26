import type { MealType } from '@/database/models/NutritionLog';

/**
 * The type model of voice commands: what a spoken sentence can become. Pure (type-only imports).
 *
 * A model answers with a {@link VoiceCommand}: a tool name and flat slots holding what the person
 * said, with days as relative words. Code turns it into a {@link VoiceAction} with real calendar
 * days (`tools.ts`), so a model never needs to know today's date and never writes anything.
 */

/** The actions voice can run. Adding one is a name here and an entry in `VOICE_TOOLS`. */
export const VOICE_ACTION_TOOLS = ['copy_meal', 'search_food'] as const;
export type VoiceActionTool = (typeof VOICE_ACTION_TOOLS)[number];

/**
 * Answers that run nothing. `none`: what was said is not a request to do something (a question, a
 * negation, a habit). `cant_determine_tool`: it is a request, but which action (or what it refers
 * to) cannot be told.
 */
export const VOICE_NON_ACTION_TOOLS = ['none', 'cant_determine_tool'] as const;
export type VoiceNonActionTool = (typeof VOICE_NON_ACTION_TOOLS)[number];

export const VOICE_TOOL_NAMES = [...VOICE_ACTION_TOOLS, ...VOICE_NON_ACTION_TOOLS] as const;
export type VoiceToolName = (typeof VOICE_TOOL_NAMES)[number];

export const VOICE_MEALS = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'other',
] as const satisfies readonly MealType[];

/** The day an action happens on, relative to the moment of speaking. */
export const VOICE_DAYS = ['today', 'yesterday', 'tomorrow'] as const;
export type VoiceDay = (typeof VOICE_DAYS)[number];

/** Monday first. A weekday means the latest such day before the day the action happens on. */
export const VOICE_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type VoiceWeekday = (typeof VOICE_WEEKDAYS)[number];

/** The day something is copied from. */
export const VOICE_SOURCE_DAYS = ['today', 'yesterday', 'two_days_ago', ...VOICE_WEEKDAYS] as const;
export type VoiceSourceDay = (typeof VOICE_SOURCE_DAYS)[number];

/** One command per hold. The reply is a list so that raising this needs no new schema shape. */
export const MAX_VOICE_COMMANDS = 1;
export const MAX_VOICE_FOOD_CHARS = 80;

/** One parsed command. A slot nobody spoke about is `null`; no slot is ever invented. */
export type VoiceCommand = {
  tool: VoiceToolName;
  /** The meal the action happens in. */
  meal: MealType | null;
  day: VoiceDay | null;
  fromMeal: MealType | null;
  fromDay: VoiceSourceDay | null;
  /** In the speaker's own words and language. */
  food: string | null;
};

export type VoiceAction =
  | {
      kind: 'copyMeal';
      /** Local midnight of the day copied into. */
      targetDay: Date;
      /** Local midnight, or null when no day was said: the review asks for it. */
      sourceDay: Date | null;
      /** Null copies the whole day, every food keeping its meal. */
      meals: { source: MealType; target: MealType } | null;
    }
  | {
      kind: 'searchFood';
      /** Local midnight of the day the food would be logged on. */
      day: Date;
      mealType: MealType;
      query: string;
    };

/**
 * Why a sentence ran nothing. Only `noAction` is answered in a modal; the others are an error
 * snackbar.
 */
export type VoiceRejection =
  'noAction' | 'cantDetermine' | 'missingFood' | 'sourceNotEarlier' | 'unreadable';

export type VoiceResolution =
  { ok: true; action: VoiceAction } | { ok: false; reason: VoiceRejection };
