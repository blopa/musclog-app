// Problems code can see in a generated plan, for the critique round of the High and Tokenmaxxing
// thinking levels: the critic is told about them, and a revision is kept only when it has no more of
// them than the plan it revises. Pure and relative-import-only. Each finding is one short English
// sentence for the model; only constraints the request really stated are checked.

import type {
  CalculateVolumeResponse,
  GenerateMealPlanResponse,
  GenerateWorkoutPlanResponse,
} from './coachAI';
import { ingredientMacroProblems } from './mealPlausibility';

/** Sane bounds for one prescription; outside them a number is a typo, not a programme. */
const MAX_SETS = 10;
const MAX_REPS = 50;
/** How far a day of a meal plan may be from the targets it was asked to meet. */
const MEAL_PLAN_TARGET_SHARE = 0.1;

const isCount = (value: unknown, max: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;

export function workoutPlanFindings(plan: GenerateWorkoutPlanResponse): string[] {
  const findings: string[] = [];
  const workouts = plan.workoutPlan ?? [];
  if (workouts.length === 0) {
    findings.push('The plan has no workouts.');
  }

  workouts.forEach((workout, index) => {
    const label = workout.title?.trim() ? `"${workout.title.trim()}"` : `Workout ${index + 1}`;
    const exercises = workout.exercises ?? [];
    if (exercises.length === 0) {
      findings.push(`${label} has no exercises.`);
    }

    const seen = new Set<string>();
    for (const exercise of exercises) {
      if (seen.has(exercise.exerciseId)) {
        findings.push(`${label} lists exercise ${exercise.exerciseId} more than once.`);
      }

      seen.add(exercise.exerciseId);
      if (!isCount(exercise.sets, MAX_SETS)) {
        findings.push(`${label}: exercise ${exercise.exerciseId} has ${exercise.sets} sets.`);
      }

      if (!isCount(exercise.reps, MAX_REPS)) {
        findings.push(`${label}: exercise ${exercise.exerciseId} has ${exercise.reps} reps.`);
      }

      const percentage = exercise.oneRepMaxPercentage;
      if (typeof percentage === 'number' && (percentage < 0 || percentage > 100)) {
        findings.push(
          `${label}: exercise ${exercise.exerciseId} is at ${percentage}% of one-rep max.`
        );
      }
    }
  });

  return findings;
}

export type MealPlanTargets = { calories: number; protein: number };

export function mealPlanFindings(
  plan: GenerateMealPlanResponse,
  targets?: MealPlanTargets
): string[] {
  const findings: string[] = [];
  const meals = plan.meals ?? [];
  if (meals.length === 0) {
    findings.push('The plan has no meals.');
  }

  const days = new Map<number, { calories: number; protein: number }>();
  for (const meal of meals) {
    const ingredients = meal.ingredients ?? [];
    if (ingredients.length === 0) {
      findings.push(`Day ${meal.day}, "${meal.name}" has no ingredients.`);
    }

    for (const ingredient of ingredients) {
      if (ingredientMacroProblems(ingredient).length > 0) {
        findings.push(
          `Day ${meal.day}, "${meal.name}": the numbers of ${ingredient.name} do not add up.`
        );
      }
    }

    const day = days.get(meal.day) ?? { calories: 0, protein: 0 };
    for (const ingredient of ingredients) {
      day.calories += ingredient.kcal ?? 0;
      day.protein += ingredient.protein ?? 0;
    }

    days.set(meal.day, day);
  }

  if (targets) {
    for (const [day, totals] of days) {
      for (const key of ['calories', 'protein'] as const) {
        const target = targets[key];
        if (target > 0 && Math.abs(totals[key] - target) > MEAL_PLAN_TARGET_SHARE * target) {
          findings.push(
            `Day ${day} has ${Math.round(totals[key])} ${key === 'calories' ? 'kcal' : 'g protein'}; the target is ${Math.round(target)}.`
          );
        }
      }
    }
  }

  return findings;
}

export function workoutVolumeFindings(volume: CalculateVolumeResponse): string[] {
  const findings: string[] = [];
  for (const exercise of volume.workoutVolume ?? []) {
    const sets = exercise.sets ?? [];
    if (sets.length === 0) {
      findings.push(`Exercise ${exercise.exerciseId} has no sets.`);
    } else if (sets.length > MAX_SETS) {
      findings.push(`Exercise ${exercise.exerciseId} has ${sets.length} sets.`);
    }

    for (const set of sets) {
      if (!isCount(set.reps, MAX_REPS)) {
        findings.push(`Exercise ${exercise.exerciseId}, set ${set.setId} has ${set.reps} reps.`);
      }

      if (typeof set.weight !== 'number' || !Number.isFinite(set.weight) || set.weight < 0) {
        findings.push(
          `Exercise ${exercise.exerciseId}, set ${set.setId} has a weight of ${set.weight}.`
        );
      }
    }
  }

  return findings;
}
