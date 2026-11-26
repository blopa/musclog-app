import { localCalendarDayDate, localCalendarDayPlusDays } from '@/utils/calendarDate';
import { mealTypeForHour } from '@/utils/mealTypeForHour';
import { isFoodSaid } from '@/utils/voiceCommand/grounding';
import {
  VOICE_WEEKDAYS,
  type VoiceCommand,
  type VoiceDay,
  type VoiceResolution,
  type VoiceResolveContext,
  type VoiceSourceDay,
  type VoiceWeekday,
} from '@/utils/voiceCommand/types';

/**
 * Turns the relative words a model answered with into calendar days. This is the only place a
 * spoken day becomes a date, so it never depends on the model knowing today. All arithmetic is
 * calendar arithmetic (`localCalendarDayPlusDays`), which is safe across DST.
 */

const DAY_OFFSET: Record<VoiceDay, number> = { today: 0, yesterday: -1, tomorrow: 1 };

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
  { now }: VoiceResolveContext
): VoiceResolution {
  const targetDay = relativeDay(command.day, now);
  // Nothing said means nothing picked: the review asks for the day instead of the app guessing.
  const from = command.fromDay ? sourceDay(command.fromDay, now, targetDay) : null;
  if (from && from.getTime() >= targetDay.getTime()) {
    return { ok: false, reason: 'sourceNotEarlier' };
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
  { now, transcript }: VoiceResolveContext
): VoiceResolution {
  const query = command.food?.trim();
  if (!query) {
    return { ok: false, reason: 'missingFood' };
  }

  // A model fills the slot from its examples; a food the person never said is not a request.
  if (!isFoodSaid(query, transcript)) {
    return { ok: false, reason: 'cantDetermine' };
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
