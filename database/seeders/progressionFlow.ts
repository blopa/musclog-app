import { Q } from '@nozbe/watermelondb';
import { Dumbbell } from 'lucide-react-native';

import { database } from '@/database/database-instance';
import Exercise from '@/database/models/Exercise';
import User from '@/database/models/User';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionService } from '@/database/services/NutritionService';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { DEFAULT_THEME_BY_MODE } from '@/theme.registry';
import { isProduction } from '@/utils/app';
import { localDayKeyPlusCalendarDays, localDayStartMs } from '@/utils/calendarDate';
import { setOnboardingCompleted } from '@/utils/onboardingService';
import { getCurrentTimezone } from '@/utils/timezone';
import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';

/** Real database fixtures for the development-only progression interaction screen. */
export async function seedProgressionFlow(locale = 'en-US', theme: 'light' | 'dark' = 'dark') {
  if (isProduction()) {
    throw new Error('Development fixture');
  }

  await SettingsService.setLanguage(locale);
  await SettingsService.setTheme(DEFAULT_THEME_BY_MODE[theme]);
  await SettingsService.setUnits('metric');
  await SettingsService.setWorkoutAutonomy('manual');
  await SettingsService.setAutoStartRestTimer(true);
  await SettingsService.setWorkoutView('inline');
  await SettingsService.setReviewWeekday(1);
  await setOnboardingCompleted();
  const today = localDayStartMs(new Date());
  const period = weeklyReviewPeriod();
  const timezone = getCurrentTimezone();
  if (
    !(
      await database
        .get<User>('users')
        .query(Q.where('deleted_at', Q.eq(null)))
        .fetch()
    ).length
  ) {
    await database.write(() =>
      database.get<User>('users').create((r) => {
        r.fullName = 'Progression tester';
        r.gender = 'other';
        r.dateOfBirth = new Date(1990, 0, 1).getTime();
        r.activityLevel = 2;
        r.fitnessGoal = 'strength';
        r.weightGoal = 'maintain';
        r.liftingExperience = 'intermediate';
        r.createdAt = Date.now();
        r.updatedAt = Date.now();
      })
    );
  }

  await UserMetricService.createMetric({
    type: 'height',
    value: 175,
    unit: 'cm',
    date: localDayKeyPlusCalendarDays(period.start, -28),
    timezone,
  });
  for (let day = -28; day < 7; day++) {
    const date = localDayKeyPlusCalendarDays(period.start, day);
    await UserMetricService.createMetric({
      type: 'weight',
      value: 80 + Math.sin(day) * 0.2,
      unit: 'kg',
      date,
      timezone,
    });
    await NutritionService.logCustomMeal(
      {
        name: 'Complete day fixture',
        calories: 2300,
        protein: 150,
        carbs: 250,
        fat: 75,
        fiber: 30,
      },
      new Date(date),
      'lunch'
    );
  }

  const goal = await NutritionGoalService.saveGoals({
    totalCalories: 2100,
    protein: 140,
    carbs: 220,
    fats: 70,
    fiber: 30,
    eatingPhase: 'maintain',
    targetMode: 'weekly',
  });
  const ex = await database.write(() =>
    database.get<Exercise>('exercises').create((r) => {
      r.name = 'Bench press fixture';
      r.equipmentType = 'barbell';
      r.mechanicType = 'compound';
      r.createdAt = Date.now();
      r.updatedAt = Date.now();
    })
  );
  const template = await WorkoutTemplateService.saveTemplate({
    name: 'Progression fixture',
    selectedDays: [0, 1, 2, 3, 4, 5, 6],
    exercises: [
      {
        id: ex.id,
        label: ex.name,
        description: '3 × 8–12',
        icon: Dumbbell,
        iconBgColor: '#ddd',
        iconColor: '#000',
        sets: 3,
        reps: 10,
        weight: 60,
        isBodyweight: false,
        restTimeAfter: 90,
        progression: { type: 'double_progression', repMin: 8, repMax: 12 },
      },
    ],
  });
  const past = await WorkoutService.startWorkoutFromTemplate(template.id);
  const blocks = await database
    .get<WorkoutLogExercise>('workout_log_exercises')
    .query(Q.where('workout_log_id', past.id))
    .fetch();
  const sets = await database
    .get<WorkoutLogSet>('workout_log_sets')
    .query(Q.where('log_exercise_id', blocks[0].id))
    .fetch();
  await database.write(async () => {
    await database.batch(
      past.prepareUpdate((r) => {
        r.startedAt = localDayKeyPlusCalendarDays(period.end, -2) + 12 * 3600000;
        r.completedAt = r.startedAt + 3600000;
        r.totalVolume = 2160;
        r.createdAt = r.startedAt;
      }),
      ...sets.map((s) =>
        s.prepareUpdate((r) => {
          r.weight = 60;
          r.reps = 12;
          r.completionStatus = 'performed';
          r.rirRecorded = false;
        })
      )
    );
  });
  const active = await WorkoutService.startWorkoutFromTemplate(template.id);
  return { logId: active.id, templateId: template.id, goalId: goal.id, today };
}
