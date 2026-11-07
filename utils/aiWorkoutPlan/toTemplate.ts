import type { RawWorkoutTemplate, RawWorkoutTemplateExercise } from '@/data/workoutTemplates';

import type { WorkoutPlanDraft } from './contract';
import type { ResolvedWorkout } from './resolveExercises';

export type PlanCreateOptions = { cycleType?: 'weekly'; weekDays?: number[] };

/**
 * Turns a reviewed plan into the shape `WorkoutTemplateService.createWorkoutsFromJsonTemplate`
 * already builds bundled programs from, so a plan from outside the app takes exactly the same road
 * into the database (slug lookup, suggested starting loads, supersets, plan membership).
 *
 * Weekdays make a weekly plan pinned to those days; without them the workouts rotate. Days are
 * numbered from the workouts that survived matching, so a dropped one leaves no gap in "Day N".
 */
export function planToRawTemplate(
  plan: WorkoutPlanDraft,
  workouts: readonly ResolvedWorkout[]
): { template: RawWorkoutTemplate; options: PlanCreateOptions } {
  const dayNames: Record<string, string> = {};
  const exercises: RawWorkoutTemplateExercise[] = [];

  workouts.forEach((workout, index) => {
    const day = index + 1;
    if (workout.name) {
      dayNames[String(day)] = workout.name;
    }

    for (const exercise of workout.exercises) {
      exercises.push({
        exerciseSlug: exercise.exerciseSlug,
        day,
        sets: exercise.sets,
        reps: exercise.reps,
        ...(exercise.minReps === undefined ? {} : { minReps: exercise.minReps }),
        ...(exercise.restSeconds === undefined ? {} : { restTimeAfter: exercise.restSeconds }),
        ...(exercise.notes ? { notes: exercise.notes } : {}),
        ...(exercise.supersetGroup ? { supersetGroup: exercise.supersetGroup } : {}),
      });
    }
  });

  return {
    template: {
      title: plan.title,
      ...(plan.description ? { description: plan.description } : {}),
      ...(plan.difficulty ? { difficulty: plan.difficulty } : {}),
      ...(Object.keys(dayNames).length > 0 ? { dayNames } : {}),
      exercises,
    },
    options: plan.weekDays.length > 0 ? { cycleType: 'weekly', weekDays: plan.weekDays } : {},
  };
}
