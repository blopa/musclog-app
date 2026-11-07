import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type Food from '@/database/models/Food';
import type Meal from '@/database/models/Meal';
import type MenstrualCycle from '@/database/models/MenstrualCycle';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutTemplate from '@/database/models/WorkoutTemplate';
import { CycleContextService } from '@/database/services/CycleContextService';
import { CycleDayLogService } from '@/database/services/CycleDayLogService';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';
import { MealService } from '@/database/services/MealService';
import { NoteService } from '@/database/services/NoteService';
import { NutritionService } from '@/database/services/NutritionService';
import { WorkoutPlanService } from '@/database/services/WorkoutPlanService';
import { combineLocalDateAndTime, localDayStartMs, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

/**
 * Extra records for the layout audit, on top of the demo data (`seedDevData`). The demo data was
 * made for the store screenshots, which never open the screens below, so they were audited empty:
 * notes, the cycle screen without a single day log, a food diary with no snack, no "other" meal and
 * no grouped meal, a Weekly Review without goals and a workout library without a plan.
 *
 * Only `?demoModeEnabled=true&layoutAuditData=true` in a screenshots build runs it
 * (`shouldSeedLayoutAuditData`), so the store and website captures keep the demo data they expect.
 * Everything goes through the services the app itself writes with, so encrypted records (cycle,
 * nutrition) are encrypted the normal way.
 */
export async function seedLayoutAuditData(now: Date = new Date()): Promise<LayoutAuditSeedSummary> {
  const today = localDayStartMs(now);
  const summary: LayoutAuditSeedSummary = {
    notes: await seedNotes(),
    cycleDayLogs: 0,
    cycleContext: false,
    diaryLogs: 0,
    groupedMeal: false,
    goals: 0,
    plan: false,
  };

  const cycle = await activeCycle();
  if (cycle) {
    summary.cycleDayLogs = await seedCycleDays(today);
    await CycleContextService.set(cycle.id, {
      effectiveFrom: today - 60 * MS_PER_SOLAR_DAY,
      lifeStage: 'regular',
      contraception: 'none',
      note: 'Stopped the pill in the summer.',
    });
    summary.cycleContext = true;
  }

  const diary = await seedDiary(today, now);
  summary.diaryLogs = diary.logs;
  summary.groupedMeal = diary.groupedMeal;
  summary.goals = await seedGoals();
  summary.plan = await seedPlan();

  return summary;
}

export interface LayoutAuditSeedSummary {
  notes: number;
  cycleDayLogs: number;
  cycleContext: boolean;
  diaryLogs: number;
  groupedMeal: boolean;
  goals: number;
  plan: boolean;
}

/** A short note, a long one with a title and one without, so the list shows each shape. */
export const LAYOUT_AUDIT_NOTES: { title?: string; body: string }[] = [
  { body: 'Ate a granola bar at the gym, log it later.' },
  {
    title: 'Dinner at Marta’s',
    body: 'Grilled salmon, roasted potatoes with rosemary, a green salad with feta and olives, then a slice of lemon cake and two glasses of red wine. Ask her for the cake recipe.',
  },
  { title: 'Supplements to try', body: 'Creatine 5 g a day. Vitamin D in winter.' },
];

async function seedNotes(): Promise<number> {
  for (const note of LAYOUT_AUDIT_NOTES) {
    await NoteService.createNote(note);
  }

  return LAYOUT_AUDIT_NOTES.length;
}

async function activeCycle(): Promise<MenstrualCycle | null> {
  const cycles = await database
    .get<MenstrualCycle>('menstrual_cycles')
    .query(Q.where('is_active', true))
    .fetch();
  return cycles[0] ?? null;
}

/**
 * Day logs around the latest seeded period (the demo starts it two weeks ago) and the last few
 * days, with bleeding, rated symptoms, pain, energy, a note and a mood: everything a day can carry.
 */
async function seedCycleDays(today: number): Promise<number> {
  const day = (daysAgo: number) => today - daysAgo * MS_PER_SOLAR_DAY;
  const entries = [
    {
      date: day(14),
      bleeding: 'heavy' as const,
      symptoms: [
        { key: 'cramps', severity: 3 as const },
        { key: 'headache', severity: 1 as const },
      ],
      pain: 7,
      energy: 2,
      note: 'Skipped the run, stayed in.',
      mood: 1,
    },
    {
      date: day(13),
      bleeding: 'medium' as const,
      symptoms: [{ key: 'cramps', severity: 2 as const }],
      pain: 4,
      energy: 3,
      note: '',
      mood: 2,
    },
    {
      date: day(12),
      bleeding: 'light' as const,
      symptoms: [{ key: 'bloating', severity: 1 as const }],
      pain: 2,
      energy: 3,
      note: '',
      mood: 3,
    },
    {
      date: day(2),
      bleeding: 'none' as const,
      symptoms: [{ key: 'bloating', severity: 2 as const }],
      pain: null,
      energy: 4,
      note: 'Felt strong at the gym.',
      mood: 4,
    },
    {
      date: day(0),
      bleeding: null,
      symptoms: [],
      pain: null,
      energy: 3,
      note: '',
      mood: 3,
    },
  ];

  for (const { mood, ...entry } of entries) {
    await CycleDayLogService.save({ ...entry, noSymptoms: entry.symptoms.length === 0 }, mood);
  }

  return entries.length;
}

/**
 * Today's diary gets the two meal types the demo leaves empty (snack and other) and a saved meal
 * logged as one group, written the way logging a saved meal writes it (one log per ingredient,
 * sharing the meal's id as `group_id` and its name as `logged_meal_name`).
 */
async function seedDiary(
  today: number,
  now: Date
): Promise<{ logs: number; groupedMeal: boolean }> {
  const foods = await database
    .get<Food>('foods')
    .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.asc), Q.take(3))
    .fetch();
  let logs = 0;
  // A meal is never logged in the future: on an early run every time collapses to "now".
  const at = (hours: number, minutes = 0) => {
    const time = combineLocalDateAndTime(new Date(today), new Date(2000, 0, 1, hours, minutes));
    return time.getTime() > now.getTime() ? now : time;
  };

  if (foods.length >= 2) {
    await NutritionService.logFood(foods[0].id, at(16, 30), 'snack', 45);
    await NutritionService.logFood(foods[1].id, at(21, 15), 'other', 120);
    logs += 2;
  }

  const meals = await database
    .get<Meal>('meals')
    .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.asc))
    .fetch();
  for (const meal of meals) {
    const withFoods = await MealService.getMealWithFoods(meal.id);
    if (!withFoods || withFoods.foods.length < 2) {
      continue;
    }

    const loggedAt = at(12, 45);
    for (const mealFood of withFoods.foods) {
      await NutritionService.logFood(
        mealFood.foodId,
        loggedAt,
        'lunch',
        mealFood.amount,
        mealFood.portionId,
        undefined,
        meal.id,
        meal.name ?? undefined
      );
      logs += 1;
    }

    return { logs, groupedMeal: true };
  }

  return { logs, groupedMeal: false };
}

/**
 * A 1RM goal on the most recent workout's first lift and a consistency goal, so the Weekly Review's
 * goal verdicts and the goals sheet have something to measure.
 */
async function seedGoals(): Promise<number> {
  const latest = await database
    .get<WorkoutLog>('workout_logs')
    .query(
      Q.where('deleted_at', Q.eq(null)),
      Q.where('completed_at', Q.notEq(null)),
      Q.sortBy('completed_at', Q.desc),
      Q.take(1)
    )
    .fetch();
  let created = 0;
  if (latest[0]) {
    const [first] = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(
        Q.where('workout_log_id', latest[0].id),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('exercise_order', Q.asc),
        Q.take(1)
      )
      .fetch();
    if (first) {
      await ExerciseGoalService.saveGoal({
        goalType: '1rm',
        exerciseId: first.exerciseId,
        targetWeight: 110,
        baseline1rm: 95,
      });
      created += 1;
    }
  }

  await ExerciseGoalService.saveGoal({ goalType: 'consistency', targetSessionsPerWeek: 3 });
  return created + 1;
}

/** Every live template in one rotating plan, so the library shows a plan section. */
async function seedPlan(): Promise<boolean> {
  const templates = await database
    .get<WorkoutTemplate>('workout_templates')
    .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.asc))
    .fetch();
  if (templates.length === 0) {
    return false;
  }

  await WorkoutPlanService.createPlan({
    name: 'Three-day split',
    description: 'Upper, lower and a grouped accessory day, in turn.',
    cycleType: 'rotating',
    memberships: templates.map((template, position) => ({ templateId: template.id, position })),
  });
  return true;
}
