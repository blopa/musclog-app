import { getExerciseCatalogue } from '@/data/exerciseCatalogue';
import workoutTemplatesData from '@/data/workoutTemplatesData.json';
import {
  getWorkoutTemplates,
  type RawWorkoutTemplateDefinition,
  type WorkoutTemplateDifficulty,
} from '@/data/workoutTemplates';
import { PLAN_MAJOR, PLAN_SCHEMA_ID } from '@/utils/aiWorkoutPlan/contract';
import { buildOpenHttpsUrl } from '@/utils/openLink';

import { PROGRAM_SLUGS, PROGRAM_SLUGS_BY_TEMPLATE_TITLE } from '../programRoutes';

export interface ProgramExercise {
  exerciseSlug: string;
  name: string;
  sets: number;
  /** The top of the rep range, or the only number. */
  reps: number;
  /** The bottom of the range, only when it differs from `reps`. */
  minReps?: number;
  restSeconds?: number;
  notes?: string;
  supersetGroup?: string;
}

export interface ProgramDay {
  /** 1-based position in the program, not the template's day number (which can skip). */
  position: number;
  /** The program's own name for the day ("Upper A"), when it has one. */
  name: string | null;
  exercises: ProgramExercise[];
}

export interface Program {
  slug: string;
  title: string;
  /** The bundled description, when the program has one (most do not). */
  description: string | null;
  difficulty: WorkoutTemplateDifficulty;
  durationMinutes: number | null;
  days: ProgramDay[];
}

const definitions = workoutTemplatesData as RawWorkoutTemplateDefinition[];

/**
 * The bundled programs in the order the index lists them, in the visitor's language. Structure
 * (days, exercises, sets, reps) comes from the same `data/workoutTemplatesData.json` the app
 * creates plans from; titles, descriptions and day names from the locale copy; exercise names
 * from the exercise catalogue. A program is joined to its copy by the template's array index, the
 * way `getWorkoutTemplates` does.
 */
export function listPrograms(locale: string | undefined): Program[] {
  const copies = getWorkoutTemplates(locale);
  const names = new Map(
    getExerciseCatalogue(locale).map((entry) => [entry.exerciseSlug, entry.name])
  );
  const programs = new Map<string, Program>();

  definitions.forEach((definition, index) => {
    const slug = (PROGRAM_SLUGS_BY_TEMPLATE_TITLE as Record<string, string | undefined>)[
      definition.__title ?? ''
    ];
    if (!slug) {
      return;
    }

    const copy = copies[index];
    const exercises = Array.isArray(definition.exercises) ? definition.exercises : [];
    const dayNumbers = [...new Set(exercises.map((exercise) => exercise.day ?? 1))].sort(
      (a, b) => a - b
    );

    programs.set(slug, {
      slug,
      title: copy.title,
      description: copy.description ?? null,
      difficulty: definition.difficulty ?? 'beginner',
      durationMinutes: typeof definition.duration === 'number' ? definition.duration : null,
      days: dayNumbers.map((dayNumber, dayIndex) => ({
        position: dayIndex + 1,
        name: copy.dayNames?.[String(dayNumber)] ?? null,
        exercises: exercises
          .filter((exercise) => (exercise.day ?? 1) === dayNumber)
          .map((exercise) => ({
            exerciseSlug: exercise.exerciseSlug ?? '',
            name: names.get(exercise.exerciseSlug ?? '') ?? exercise.exerciseSlug ?? '',
            sets: exercise.sets ?? 3,
            reps: exercise.reps ?? 10,
            ...(exercise.minReps === undefined ? {} : { minReps: exercise.minReps }),
            ...(exercise.restTimeAfter === undefined
              ? {}
              : { restSeconds: exercise.restTimeAfter }),
            ...(exercise.notes ? { notes: exercise.notes } : {}),
            ...(exercise.supersetGroup ? { supersetGroup: exercise.supersetGroup } : {}),
          })),
      })),
    });
  });

  return PROGRAM_SLUGS.flatMap((slug) => {
    const program = programs.get(slug);
    return program ? [program] : [];
  });
}

export function getProgram(slug: string, locale: string | undefined): Program | null {
  return listPrograms(locale).find((program) => program.slug === slug) ?? null;
}

/** Workouts in a program: one per day, so "3 workouts" is a count of the plan, not a schedule. */
export const workoutCount = (program: Program): number => program.days.length;

/**
 * The program as the `musclog-workout-plan` document the app's import review reads
 * (`utils/aiWorkoutPlan/contract.ts`), so an "Open in Musclog" link takes the SAME road into the
 * app as a plan an assistant wrote. It carries no loads (the app suggests them from the person's
 * profile) and no weekdays (the plan rotates until the person picks days).
 */
export function programToPlanDocument(program: Program, dayLabel: (position: number) => string) {
  return {
    schema: PLAN_SCHEMA_ID,
    version: PLAN_MAJOR,
    title: program.title,
    ...(program.description ? { description: program.description } : {}),
    difficulty: program.difficulty,
    workouts: program.days.map((day) => ({
      name: day.name ?? dayLabel(day.position),
      exercises: day.exercises.map((exercise) => ({
        exerciseSlug: exercise.exerciseSlug,
        sets: exercise.sets,
        reps: exercise.reps,
        ...(exercise.minReps === undefined ? {} : { minReps: exercise.minReps }),
        ...(exercise.restSeconds === undefined ? {} : { restSeconds: exercise.restSeconds }),
        ...(exercise.notes ? { notes: exercise.notes } : {}),
        ...(exercise.supersetGroup ? { supersetGroup: exercise.supersetGroup } : {}),
      })),
    })),
  };
}

/** `https://musclog.app/open#workout=…`: opens the import review in the app, or the bridge page. */
export function programOpenUrl(program: Program, dayLabel: (position: number) => string): string {
  return buildOpenHttpsUrl({
    kind: 'workout',
    payload: JSON.stringify(programToPlanDocument(program, dayLabel)),
  });
}
