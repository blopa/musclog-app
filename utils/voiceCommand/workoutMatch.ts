/**
 * Which saved workout a sentence names. It never guesses: every word of the name must have been
 * said, and at least one of them must be more than a word of asking ("workout", "day"). The names
 * stay on the phone; no model sees them. Pure: no React Native, no database.
 */
import { tokenizeExerciseText } from '@/utils/exerciseSearch';
import { GENERIC_WORKOUT_WORDS } from '@/utils/voiceCommand/workoutWords';

export type MatchableWorkout = {
  templateId: string;
  name: string;
  /** The plans it belongs to: a plan's name may be said with the workout's. */
  plans: readonly { planId: string; planName: string }[];
};

/** A workout to show or open, with the plan it was meant through. */
export type WorkoutChoice = {
  templateId: string;
  name: string;
  planId?: string;
  planName?: string;
};

/** Whether the sentence asks for a workout without a word that could name one. */
export function namesNoWorkout(transcript: string): boolean {
  return tokenizeExerciseText(transcript).every((word) => GENERIC_WORKOUT_WORDS.has(word));
}

/** A workout nobody named a plan of: it carries its plan only when it has exactly one. */
export function toWorkoutChoice({ templateId, name, plans }: MatchableWorkout): WorkoutChoice {
  return plans.length === 1 ? { templateId, name, ...plans[0] } : { templateId, name };
}

type Match = { choice: WorkoutChoice; length: number };

function longest(matches: Match[]): Match[] {
  const length = Math.max(0, ...matches.map((match) => match.length));

  return matches.filter((match) => match.length === length);
}

/** How the sentence names this workout: through its plans where one was said, else by its name. */
function matchesOf(workout: MatchableWorkout, said: ReadonlySet<string>): Match[] {
  const name = tokenizeExerciseText(workout.name);
  const match = (words: string[], choice: WorkoutChoice): Match[] => {
    const named =
      words.every((word) => said.has(word)) &&
      words.some((word) => !GENERIC_WORKOUT_WORDS.has(word));

    return named ? [{ choice, length: new Set(words).size }] : [];
  };

  if (name.length === 0) {
    return [];
  }

  const { templateId } = workout;
  const throughPlans = workout.plans.flatMap((plan) =>
    match([...tokenizeExerciseText(plan.planName), ...name], {
      templateId,
      name: workout.name,
      ...plan,
    })
  );

  return throughPlans.length > 0 ? longest(throughPlans) : match(name, toWorkoutChoice(workout));
}

/**
 * The workouts the sentence names, keeping only those with the longest names ("Push day" over
 * "Push"). More than one means it cannot be told which was meant.
 */
export function matchWorkoutsBySpeech(
  workouts: readonly MatchableWorkout[],
  transcript: string
): WorkoutChoice[] {
  const said = new Set(tokenizeExerciseText(transcript));

  return longest(workouts.flatMap((workout) => matchesOf(workout, said))).map(
    (match) => match.choice
  );
}
