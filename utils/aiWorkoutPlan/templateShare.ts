import { exerciseSlugFromId } from '@/utils/exerciseImage';
import { buildOpenHttpsUrl, OPEN_LINK_SUGGESTED_MAX_CHARS } from '@/utils/openLink';

import {
  DESCRIPTION_MAX,
  MAX_EXERCISES_PER_WORKOUT,
  NOTES_MAX,
  PLAN_MAJOR,
  PLAN_SCHEMA_ID,
  REPS_RANGE,
  REST_SECONDS_RANGE,
  SETS_RANGE,
  SUPERSET_GROUP_MAX,
  TITLE_MAX,
  WORKOUT_NAME_MAX,
} from './contract';

/** What the share needs of one saved set (a subset of `WorkoutTemplateSet`). */
export type ShareableTemplateSet = {
  targetReps: number;
  restTimeAfter?: number | null;
  setType?: string | null;
};

/** What the share needs of one saved exercise block (a subset of `WorkoutTemplateExercise`). */
export type ShareableTemplateExercise = {
  exerciseId: string;
  notes?: string | null;
  groupId?: string | null;
  sets: ShareableTemplateSet[];
};

export type ShareableTemplate = {
  name: string;
  description?: string | null;
  exercises: ShareableTemplateExercise[];
};

export type TemplateShare = {
  url: string;
  /** Exercises left out: custom exercises have no catalogue slug the other phone could resolve. */
  skippedExercises: number;
};

const clamp = (value: number, [min, max]: readonly [number, number]) =>
  Math.min(max, Math.max(min, Math.round(value)));

/**
 * Turns one saved workout into the `musclog-workout-plan` document the import review reads, with a
 * single workout. Only catalogue exercises can travel (the document names exercises by slug, and a
 * custom exercise exists on this phone only); warm-up sets are not part of the plan; the document
 * carries no loads, the receiver's own profile suggests them. Returns null when nothing is left.
 */
export function templateToPlanDocument(
  template: ShareableTemplate
): { document: Record<string, unknown>; skippedExercises: number } | null {
  let skippedExercises = 0;
  const groupLabels = new Map<string, string>();
  const exercises: Record<string, unknown>[] = [];

  for (const block of template.exercises) {
    const slug = exerciseSlugFromId(block.exerciseId);
    const working = block.sets.filter((set) => set.setType !== 'warmup');

    if (!slug || working.length === 0 || exercises.length >= MAX_EXERCISES_PER_WORKOUT) {
      skippedExercises += 1;
      continue;
    }

    const reps = working.map((set) => clamp(set.targetReps, REPS_RANGE));
    const top = Math.max(...reps);
    const bottom = Math.min(...reps);
    const rest = working[0].restTimeAfter;
    const note = block.notes?.trim();
    let supersetGroup: string | undefined;

    if (block.groupId) {
      if (!groupLabels.has(block.groupId)) {
        groupLabels.set(block.groupId, String(groupLabels.size + 1).slice(0, SUPERSET_GROUP_MAX));
      }

      supersetGroup = groupLabels.get(block.groupId);
    }

    exercises.push({
      exerciseSlug: slug,
      sets: clamp(working.length, SETS_RANGE),
      reps: top,
      ...(bottom < top ? { minReps: bottom } : {}),
      ...(typeof rest === 'number' && rest > 0
        ? { restSeconds: clamp(rest, REST_SECONDS_RANGE) }
        : {}),
      ...(note ? { notes: note.slice(0, NOTES_MAX) } : {}),
      ...(supersetGroup ? { supersetGroup } : {}),
    });
  }

  if (exercises.length === 0) {
    return null;
  }

  const name = template.name.trim();
  const description = template.description?.trim();
  const title = (name || 'Workout').slice(0, TITLE_MAX);

  return {
    skippedExercises,
    document: {
      schema: PLAN_SCHEMA_ID,
      version: PLAN_MAJOR,
      title,
      ...(description ? { description: description.slice(0, DESCRIPTION_MAX) } : {}),
      workouts: [{ name: title.slice(0, WORKOUT_NAME_MAX), exercises }],
    },
  };
}

/**
 * The `https://musclog.app/open#workout=…` link for a saved workout, or null when nothing can be
 * shared or the link would exceed the size the rest of the open-link code accepts. The payload sits
 * in the URL fragment, so no server ever sees it.
 */
export function buildTemplateShare(template: ShareableTemplate): TemplateShare | null {
  const built = templateToPlanDocument(template);

  if (!built) {
    return null;
  }

  const url = buildOpenHttpsUrl({ kind: 'workout', payload: JSON.stringify(built.document) });

  return url.length > OPEN_LINK_SUGGESTED_MAX_CHARS
    ? null
    : { url, skippedExercises: built.skippedExercises };
}
