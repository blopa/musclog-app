import type { CameraMode } from '@/constants/camera';
import type { NavItemKey, Units } from '@/constants/settings';
import type { MealType } from '@/database/models/NutritionLog';
import type { CardioActivity } from '@/utils/cardioEnergy';

/**
 * The type model of voice commands: what a spoken sentence can become. Pure (type-only imports).
 *
 * A model answers with a {@link VoiceCommand}: a tool name and flat slots holding what the person
 * said, with days as relative words. Code turns it into a {@link VoiceAction} with real calendar
 * days (`tools.ts`), so a model never needs to know today's date and never writes anything.
 */

/** The actions voice can run. Adding one is a name here and an entry in `VOICE_TOOLS`. */
export const VOICE_ACTION_TOOLS = [
  'copy_meal',
  'search_food',
  'log_weight',
  'log_meal',
  'add_note',
  'go_to',
  'ask_coach',
  'start_workout',
  'log_cardio',
  'open_camera',
] as const;
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

/** The unit a spoken weight was said in. */
export type VoiceWeightUnit = 'kg' | 'lb';

/**
 * Which downloaded model a native tool-call payload is written for; each was measured with its own.
 * `main`: the 450M, shown example turns. `text`: the optional 1.2B, told what to do in one line and
 * shown its own wording of some tools.
 */
export type NativeVoiceModel = 'main' | 'text';

/**
 * Where `go_to` can take a person: Home and every navigation destination. `cycle` is always offered
 * to the model, so the choices never say whether this person tracks a cycle; the app checks that
 * the screen is available after the answer.
 */
export const VOICE_SCREENS = [
  'home',
  'food',
  'workouts',
  'profile',
  'progress',
  'cycle',
  'checkin',
  'notes',
  'settings',
  'coach',
] as const satisfies readonly (NavItemKey | 'home')[];
export type VoiceScreen = (typeof VOICE_SCREENS)[number];

/** What a spoken sentence can ask the camera to be used for. Each is one of `CameraMode`. */
export const VOICE_CAMERA_MODES = ['barcode', 'food_photo', 'label'] as const;
export type VoiceCameraMode = (typeof VOICE_CAMERA_MODES)[number];

/** The activities voice can log. Any other sport runs nothing. */
export const VOICE_ACTIVITIES = ['walk', 'run'] as const satisfies readonly CardioActivity[];

/** One command per hold. The reply is a list so that raising this needs no new schema shape. */
export const MAX_VOICE_COMMANDS = 1;
export const MAX_VOICE_FOOD_CHARS = 80;
export const MAX_VOICE_NOTE_CHARS = 2000;
/** A weight is digits, perhaps with a unit the model repeated. */
export const MAX_VOICE_WEIGHT_CHARS = 20;

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
  /** The body weight as the model wrote it; code checks it against what was said. */
  weight: string | null;
  /** The words of a note. */
  text: string | null;
  screen: VoiceScreen | null;
  cameraMode: VoiceCameraMode | null;
  activity: CardioActivity | null;
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
    }
  | {
      kind: 'logWeight';
      /** Local midnight of the day of the weigh-in. */
      day: Date;
      /**
       * In kilograms, as the database stores it; the sheet shows it in the person's own unit. Null
       * when no weight could be read (the person picked the tool): the sheet starts empty.
       */
      weightKg: number | null;
    }
  | {
      kind: 'logMeal';
      /** Local midnight of the day the meal would be logged on. */
      day: Date;
      mealType: MealType;
      /** What was said: the meal estimate reads the foods and amounts from it. */
      description: string;
    }
  | { kind: 'addNote'; body: string }
  | { kind: 'goTo'; screen: VoiceScreen }
  /** The sentence goes into the coach's composer; the person sends it. */
  | { kind: 'askCoach'; text: string }
  /** `mode` null: what the bottom bar's camera button opens. */
  | { kind: 'openCamera'; mode: CameraMode | null }
  /** Which workout is meant is looked up on the phone, from what was said. */
  | { kind: 'startWorkout'; said: string }
  /** Made by the app once a workout is found, never by a resolver: the preview to show. */
  | { kind: 'previewWorkout'; templateId: string; planId?: string }
  | {
      kind: 'logCardio';
      /** Local midnight of the day the walk or run happened. */
      day: Date;
      activity: CardioActivity;
      /** Null when none was said: the sheet starts at zero. */
      distanceM: number | null;
      durationS: number | null;
    };

export type VoiceActionKind = VoiceAction['kind'];

/** Why a sentence ran nothing. Each is answered by asking the person which tool they meant. */
export type VoiceRejection =
  'noAction' | 'cantDetermine' | 'missingFood' | 'sourceNotEarlier' | 'unreadable';

export type VoiceResolution =
  { ok: true; action: VoiceAction } | { ok: false; reason: VoiceRejection };

/** What a command is resolved against: the moment of speaking and what the person said. */
export type VoiceResolveContext = {
  now: Date;
  transcript: string;
  /** The account's weight unit, used when none was said. */
  weightUnit: VoiceWeightUnit;
  /** The account's unit system, for a distance said without a unit. */
  units: Units;
  /** The person picked the tool: resolve to an action, leaving out whatever cannot be used. */
  chosen?: boolean;
};
