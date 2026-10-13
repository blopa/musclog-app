import type { GymSnapshot } from './gym';

interface PromptExercise {
  id: string;
  name?: string | null;
}

/**
 * The exercise-related lines of the workout-plan system prompt.
 *
 * `exercises` must already be filtered down to what may be suggested (see
 * `ExerciseSuggestionService`): the model is told to use ONLY this list, so an exercise left off it
 * — because it hurts, or the gym has no machine for it — is one it can never put in the plan. The
 * plan is still checked after the fact, because a model can ignore a list.
 */
export function buildWorkoutPlanExerciseSection({
  exercises,
  dislikedNames = [],
  gym,
}: {
  exercises: readonly PromptExercise[];
  dislikedNames?: readonly string[];
  gym?: (Pick<GymSnapshot, 'equipment'> & { name?: string }) | null;
}): string[] {
  const list = JSON.stringify(
    exercises.map((exercise) => ({ id: exercise.id, name: exercise.name ?? '' })),
    null,
    2
  );

  return [
    'You MUST only use exercises from the list below. For each exercise in your plan, return the exact "id" from this list (do not invent IDs).',
    ...(gym && gym.equipment.length > 0
      ? [
          `The user trains at ${gym.name ? `"${gym.name}"` : 'a gym'}, which has: ${gym.equipment.join(', ')} (bodyweight exercises are always possible). The list below already contains only exercises they can do there.`,
        ]
      : []),
    ...(dislikedNames.length > 0
      ? [
          `The user dislikes these exercises, so prefer others unless one is clearly the best choice: ${dislikedNames.join(', ')}.`,
        ]
      : []),
    'Available exercises (id, name):',
    '```json',
    list,
    '```',
  ];
}
