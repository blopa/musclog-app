import type { CameraMode } from '@/constants/camera';
import { localCalendarDayDate, localCalendarDayPlusDays } from '@/utils/calendarDate';
import { mealTypeForHour } from '@/utils/mealTypeForHour';
import { isFoodSaid, isMostlySaid } from '@/utils/voiceCommand/grounding';
import { mealOfWord } from '@/utils/voiceCommand/mealWords';
import { readSpokenActivity, readSpokenCardio } from '@/utils/voiceCommand/spokenCardio';
import { mentionsBodyWeight, readSpokenWeight } from '@/utils/voiceCommand/spokenWeight';
import {
  VOICE_WEEKDAYS,
  type VoiceCameraMode,
  type VoiceCommand,
  type VoiceDay,
  type VoiceResolution,
  type VoiceResolveContext,
  type VoiceSourceDay,
  type VoiceWeekday,
  type VoiceWeightUnit,
} from '@/utils/voiceCommand/types';
import { LB_TO_KG } from '@/utils/workoutImport/parseNumber';

/**
 * Turns the relative words a model answered with into calendar days. This is the only place a
 * spoken day becomes a date, so it never depends on the model knowing today. All arithmetic is
 * calendar arithmetic (`localCalendarDayPlusDays`), which is safe across DST.
 */

const DAY_OFFSET: Record<VoiceDay, number> = { today: 0, yesterday: -1, tomorrow: 1 };

const CAMERA_MODES: Record<VoiceCameraMode, CameraMode> = {
  barcode: 'barcode-scan',
  food_photo: 'ai-meal-photo',
  label: 'ai-label-scan',
};

/** A body weight outside this range is a misheard number, not a weigh-in. */
const MIN_BODY_WEIGHT_KG = 20;
const MAX_BODY_WEIGHT_KG = 400;

function isWeekday(day: VoiceSourceDay): day is VoiceWeekday {
  return (VOICE_WEEKDAYS as readonly string[]).includes(day);
}

function relativeDay(day: VoiceDay | null, now: Date): Date {
  return localCalendarDayPlusDays(localCalendarDayDate(now), DAY_OFFSET[day ?? 'today']);
}

/** The latest `weekday` strictly before `before`. `VOICE_WEEKDAYS` is Monday-first. */
function lastWeekdayBefore(weekday: VoiceWeekday, before: Date): Date {
  // `Date#getDay` counts from Sunday = 0.
  const wanted = (VOICE_WEEKDAYS.indexOf(weekday) + 1) % 7;
  const daysBack = ((before.getDay() - wanted + 6) % 7) + 1;

  return localCalendarDayPlusDays(before, -daysBack);
}

function sourceDay(day: VoiceSourceDay, now: Date, targetDay: Date): Date {
  if (isWeekday(day)) {
    return lastWeekdayBefore(day, targetDay);
  }

  const offset = { today: 0, yesterday: -1, two_days_ago: -2 }[day];

  return localCalendarDayPlusDays(localCalendarDayDate(now), offset);
}

export function resolveCopyMeal(
  command: VoiceCommand,
  { now, chosen }: VoiceResolveContext
): VoiceResolution {
  const targetDay = relativeDay(command.day, now);
  // Nothing said means nothing picked: the review asks for the day instead of the app guessing.
  let from = command.fromDay ? sourceDay(command.fromDay, now, targetDay) : null;
  if (from && from.getTime() >= targetDay.getTime()) {
    if (!chosen) {
      return { ok: false, reason: 'sourceNotEarlier' };
    }

    from = null;
  }

  // One meal said stands for both sides ("same breakfast"); none means the whole day.
  const source = command.fromMeal ?? command.meal;
  const target = command.meal ?? command.fromMeal;

  return {
    ok: true,
    action: {
      kind: 'copyMeal',
      targetDay,
      sourceDay: from,
      meals: source && target ? { source, target } : null,
    },
  };
}

export function resolveSearchFood(
  command: VoiceCommand,
  context: VoiceResolveContext
): VoiceResolution {
  const { now, transcript, chosen } = context;
  let query = command.food?.trim() ?? '';
  // A person who picked the search gets it, empty rather than with a word that is not their food.
  if (chosen && (!isFoodSaid(query, transcript) || mealOfWord(query))) {
    query = '';
  }

  if (!chosen) {
    if (!query) {
      return { ok: false, reason: 'missingFood' };
    }

    // A model fills the slot from its examples; a food the person never said is not a request.
    if (!isFoodSaid(query, transcript)) {
      return { ok: false, reason: 'cantDetermine' };
    }
  }

  // A meal's name is not a food: "the same breakfast as yesterday" read as a search for
  // "breakfast". It opens the copy review instead, which asks which day to copy and writes nothing
  // until confirmed. The model's `day` is not trusted as the source: it may mean either side.
  const meal = mealOfWord(query);
  if (meal) {
    return resolveCopyMeal(
      {
        ...command,
        meal: command.meal ?? meal,
        fromMeal: meal,
        fromDay: null,
        day: command.day === 'tomorrow' ? 'tomorrow' : null,
      },
      context
    );
  }

  return {
    ok: true,
    action: {
      kind: 'searchFood',
      day: relativeDay(command.day, now),
      // The person can still change the meal when they log the food.
      mealType: command.meal ?? mealTypeForHour(now.getHours()),
      query,
    },
  };
}

/** The weight in kilograms, or null for a number no person weighs. */
function bodyWeightKg(value: number, unit: VoiceWeightUnit): number | null {
  const kilograms = unit === 'lb' ? value * LB_TO_KG : value;

  return kilograms >= MIN_BODY_WEIGHT_KG && kilograms <= MAX_BODY_WEIGHT_KG ? kilograms : null;
}

/**
 * The weight is the one number in the transcript: the model only has to agree with it, so it can
 * neither invent a weight nor read it wrongly. It is in the unit said next to the number, else the
 * person's own, and comes out in kilograms. The sentence must be about weight (a unit or a word for
 * weighing). Nobody weighs themselves tomorrow.
 */
export function resolveLogWeight(
  command: VoiceCommand,
  { now, transcript, weightUnit, chosen }: VoiceResolveContext
): VoiceResolution {
  const spoken = readSpokenWeight(transcript);
  const weightKg = spoken ? bodyWeightKg(spoken.value, spoken.unit ?? weightUnit) : null;
  if (!chosen) {
    const named = command.weight ? readSpokenWeight(command.weight) : null;
    const agrees =
      spoken !== null &&
      weightKg !== null &&
      named !== null &&
      Math.abs(named.value - spoken.value) < 0.01;
    if (!agrees || command.day === 'tomorrow' || !mentionsBodyWeight(transcript)) {
      return { ok: false, reason: 'cantDetermine' };
    }
  }

  const day = command.day === 'tomorrow' ? null : command.day;

  return {
    ok: true,
    action: { kind: 'logWeight', day: relativeDay(day, now), weightKg },
  };
}

/** The whole sentence is the meal's description: the estimate reads foods and amounts from it. */
export function resolveLogMeal(
  command: VoiceCommand,
  { now, transcript }: VoiceResolveContext
): VoiceResolution {
  return {
    ok: true,
    action: {
      kind: 'logMeal',
      day: relativeDay(command.day, now),
      mealType: command.meal ?? mealTypeForHour(now.getHours()),
      description: transcript.trim(),
    },
  };
}

/** The model's wording of the note when it was said, else everything that was said. */
export function resolveAddNote(
  command: VoiceCommand,
  { transcript }: VoiceResolveContext
): VoiceResolution {
  const said = command.text && isMostlySaid(command.text, transcript) ? command.text : null;

  return { ok: true, action: { kind: 'addNote', body: said ?? transcript.trim() } };
}

export function resolveGoTo(
  command: VoiceCommand,
  { chosen }: VoiceResolveContext
): VoiceResolution {
  if (!command.screen && !chosen) {
    return { ok: false, reason: 'cantDetermine' };
  }

  return { ok: true, action: { kind: 'goTo', screen: command.screen ?? 'home' } };
}

/** A question or a request for advice: the whole sentence is what the coach is asked. */
export function resolveAskCoach(
  _command: VoiceCommand,
  { transcript }: VoiceResolveContext
): VoiceResolution {
  return { ok: true, action: { kind: 'askCoach', text: transcript.trim() } };
}

export function resolveOpenCamera(command: VoiceCommand): VoiceResolution {
  const mode = command.cameraMode ? CAMERA_MODES[command.cameraMode] : null;

  return { ok: true, action: { kind: 'openCamera', mode } };
}

/** Which workout is meant is looked up on the phone: no saved name is ever sent to a model. */
export function resolveStartWorkout(
  _command: VoiceCommand,
  { transcript }: VoiceResolveContext
): VoiceResolution {
  return { ok: true, action: { kind: 'startWorkout', said: transcript.trim() } };
}

/**
 * The distance and the time are read from the transcript, never from the model, and one of them must
 * have been said with its unit ("I went for a run" alone is not a log). Nobody logs a run that has
 * not happened. The activity is the model's, else the one named, else a run.
 */
export function resolveLogCardio(
  command: VoiceCommand,
  { now, transcript, units, chosen }: VoiceResolveContext
): VoiceResolution {
  const { distanceM, durationS, measured } = readSpokenCardio(transcript, units);
  if (!chosen && (!measured || command.day === 'tomorrow')) {
    return { ok: false, reason: 'cantDetermine' };
  }

  const day = command.day === 'tomorrow' ? null : command.day;

  return {
    ok: true,
    action: {
      kind: 'logCardio',
      day: relativeDay(day, now),
      activity: command.activity ?? readSpokenActivity(transcript) ?? 'run',
      distanceM,
      durationS,
    },
  };
}
