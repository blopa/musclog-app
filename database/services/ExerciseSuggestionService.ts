import type Exercise from '@/database/models/Exercise';
import { ExerciseRestrictionService } from '@/database/services/ExerciseRestrictionService';
import { ExerciseService } from '@/database/services/ExerciseService';
import { GymService } from '@/database/services/GymService';
import {
  isDisliked,
  isExerciseSuggestible,
  type SubstitutionContext,
} from '@/utils/exerciseSubstitution';

export interface SuggestibleExercises {
  /** Everything that may be suggested: not never/injury, and available at the active gym. */
  exercises: Exercise[];
  /** Suggestible, but the user dislikes them — to be avoided, not forbidden. */
  disliked: Exercise[];
  context: SubstitutionContext;
}

/**
 * The single place that answers "what may the app suggest right now?" — the user's restrictions
 * and the equipment of the gym they are training in, read together. The AI plan prompt, the plan
 * post-processing and the swap list all go through here so they can never disagree.
 */
export class ExerciseSuggestionService {
  static async getContext(): Promise<SubstitutionContext> {
    const [restrictions, gym] = await Promise.all([
      ExerciseRestrictionService.listActive(),
      GymService.getActiveGym(),
    ]);
    return { restrictions, gym };
  }

  static async getSuggestibleExercises(
    all?: readonly Exercise[],
    context?: SubstitutionContext
  ): Promise<SuggestibleExercises> {
    const [exercises, ctx] = await Promise.all([
      all ? Promise.resolve(all) : ExerciseService.getAllExercises(),
      context ? Promise.resolve(context) : ExerciseSuggestionService.getContext(),
    ]);

    const suggestible = exercises.filter((exercise) => isExerciseSuggestible(exercise, ctx));
    return {
      exercises: suggestible,
      disliked: suggestible.filter((exercise) =>
        isDisliked(exercise.id, ctx.restrictions, ctx.now)
      ),
      context: ctx,
    };
  }
}
