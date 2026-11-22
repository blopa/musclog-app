import { TrainingWeekRepository } from '@/database/repositories/TrainingWeekRepository';
import { WorkoutTodayRepository } from '@/database/repositories/WorkoutTodayRepository';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionService } from '@/database/services/NutritionService';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { formatLocalCalendarDayIso, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { digestibleCarbs } from '@/utils/carbsConvention';
import {
  type CoachSnapshotInput,
  formatCoachSnapshot,
  type SnapshotMacros,
} from '@/utils/coachSnapshot';
import { kgToDisplay, storedWeightToKg } from '@/utils/unitConversion';
import { getWeightUnit } from '@/utils/units';

/** How far back the weight trend looks, and the least span that counts as a trend. */
const WEIGHT_TREND_DAYS = 28;
const WEIGHT_TREND_MIN_DAYS = 7;

/** Runs one reader; a failing source just leaves its line out instead of failing the chat. */
async function attempt<T>(label: string, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.warn(`[coachSnapshot] ${label} failed:`, error);
    return fallback;
  }
}

async function readNutrition(
  now: Date
): Promise<Pick<CoachSnapshotInput, 'targets' | 'eatenToday' | 'loggedFoodToday'>> {
  // Intuitive eating: the app states no calorie goal and neither does the coach.
  if (await SettingsService.getIntuitiveEatingMode()) {
    return { targets: null, eatenToday: null, loggedFoodToday: false };
  }

  const [goal, daily] = await Promise.all([
    NutritionGoalService.getCurrent(),
    NutritionService.getDailyNutrients(now),
  ]);
  const resolved = goal ? await NutritionTargetService.resolve(goal, now) : null;
  const targets: SnapshotMacros | null = resolved
    ? {
        calories: resolved.totalCalories,
        protein: resolved.protein,
        carbs: resolved.carbs,
        fat: resolved.fats,
        fiber: resolved.fiber,
      }
    : null;

  const eatenToday: SnapshotMacros = {
    calories: daily.calories,
    protein: daily.protein,
    // Goal carbs are net, logged carbs include fiber: compare like with like.
    carbs: digestibleCarbs(daily.carbs, daily.fiber),
    fat: daily.fat,
    fiber: daily.fiber,
  };

  return {
    targets,
    eatenToday,
    loggedFoodToday: daily.calories > 0 || daily.protein > 0 || daily.carbs > 0 || daily.fat > 0,
  };
}

async function readWeightChange(now: Date): Promise<CoachSnapshotInput['weightChange']> {
  const latest = await UserMetricService.getLatest('weight');
  if (!latest) {
    return null;
  }

  const earlier = await UserMetricService.getLatestOnOrBefore(
    'weight',
    now.getTime() - WEIGHT_TREND_DAYS * MS_PER_SOLAR_DAY
  );
  if (!earlier || earlier.id === latest.id) {
    return null;
  }

  const days = Math.round((latest.date - earlier.date) / MS_PER_SOLAR_DAY);
  if (days < WEIGHT_TREND_MIN_DAYS) {
    return null;
  }

  const [latestValue, earlierValue, units] = await Promise.all([
    latest.getDecrypted(),
    earlier.getDecrypted(),
    SettingsService.getUnits(),
  ]);
  const latestKg = storedWeightToKg(latestValue.value, latestValue.unit ?? 'kg');
  const earlierKg = storedWeightToKg(earlierValue.value, earlierValue.unit ?? 'kg');

  return {
    amount: kgToDisplay(latestKg, units) - kgToDisplay(earlierKg, units),
    unit: getWeightUnit(units),
    days,
  };
}

async function readWorkout(now: Date): Promise<CoachSnapshotInput['workout']> {
  const upcoming = await WorkoutTodayRepository.upcoming(now);
  // A suggestion made only because a workout rested longest is not "in their plan".
  const planned = upcoming.filter((item) => item.lastCompletedAt == null);
  const pick = planned.find((item) => !item.completedToday) ?? planned[0];

  return pick
    ? {
        name: pick.template.name,
        completedToday: pick.completedToday,
        scheduled: pick.scheduled,
      }
    : null;
}

async function readTrainingWeek(now: Date): Promise<CoachSnapshotInput['trainingWeek']> {
  const week = await TrainingWeekRepository.activeTrainingWeek(now.getTime());

  return week
    ? {
        decision: week.decision,
        untilDay: formatLocalCalendarDayIso(new Date(week.snapshot.window.until)),
      }
    : null;
}

/**
 * The "right now" block of the chat prompt: today's intake against the targets, the weight trend,
 * today's workout and a live Weekly Review decision. Every source is optional; '' when none has
 * anything to say. Reads are plaintext except today's logs and two weigh-ins (decrypted once).
 */
export async function loadCoachSnapshot(now: Date = new Date()): Promise<string> {
  const [nutrition, weightChange, workout, trainingWeek] = await Promise.all([
    attempt('nutrition', () => readNutrition(now), {
      targets: null,
      eatenToday: null,
      loggedFoodToday: false,
    }),
    attempt('weight', () => readWeightChange(now), null),
    attempt('workout', () => readWorkout(now), null),
    attempt('trainingWeek', () => readTrainingWeek(now), null),
  ]);

  return formatCoachSnapshot({ ...nutrition, weightChange, workout, trainingWeek });
}
