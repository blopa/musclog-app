import workoutTemplatesData from '@/data/workoutTemplatesData.json';
import workoutTemplatesEnUs from '@/data/workoutTemplatesEnUS.json';
import workoutTemplatesEsEs from '@/data/workoutTemplatesEsEs.json';
import workoutTemplatesNlNl from '@/data/workoutTemplatesNlNl.json';
import workoutTemplatesPtBr from '@/data/workoutTemplatesPtBr.json';
import workoutTemplatesRuRu from '@/data/workoutTemplatesRuRu.json';

export const WORKOUT_TEMPLATE_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

export type WorkoutTemplateDifficulty = (typeof WORKOUT_TEMPLATE_DIFFICULTIES)[number];

export type RawWorkoutTemplate = {
  title: string;
  description?: string;
  difficulty?: WorkoutTemplateDifficulty;
  duration?: number | string;
  dayNames?: Record<string, string>;
  exercises?: RawWorkoutTemplateExercise[] | number | string;
  sets?: number;
  icon?: string;
};

export type RawWorkoutTemplateExercise = {
  exerciseId?: number;
  day?: number;
  sets?: number;
  reps?: number;
  minReps?: number;
  notes?: string;
  restTimeAfter?: number;
  supersetGroup?: string;
};

/**
 * Shape of `workoutTemplatesData.json`: structural data only. Its `__title` is a reading aid for
 * maintainers, never a source of user-facing copy — titles and descriptions come from the locale
 * files (`workoutTemplatesEnUS.json` and friends), so `applyWorkoutTemplateCopies` drops it.
 */
export type RawWorkoutTemplateDefinition = Omit<RawWorkoutTemplate, 'description' | 'title'> & {
  __title?: string;
};

export type WorkoutTemplateCopy = Pick<RawWorkoutTemplate, 'title' | 'description' | 'dayNames'>;

export function applyWorkoutTemplateCopies(
  templates: RawWorkoutTemplateDefinition[],
  copies: WorkoutTemplateCopy[]
): RawWorkoutTemplate[] {
  return templates.map(({ __title, ...template }, index) => {
    const copy: undefined | WorkoutTemplateCopy = copies[index];
    return { ...template, ...copy, title: copy?.title ?? '' };
  });
}

// TODO: move this to lang.ts (which is auto-generated) - so update the auto generator to generate this
const workoutTemplateCopiesByLocale: Record<string, WorkoutTemplateCopy[]> = {
  'en-US': workoutTemplatesEnUs,
  'es-ES': workoutTemplatesEsEs,
  'nl-NL': workoutTemplatesNlNl,
  'pt-BR': workoutTemplatesPtBr,
  'ru-RU': workoutTemplatesRuRu,
};

export function getWorkoutTemplates(locale = 'en-US'): RawWorkoutTemplate[] {
  const normalizedLocale = locale.replace('_', '-');
  const localeKeys = Object.keys(workoutTemplateCopiesByLocale);
  const matchingLocale =
    localeKeys.find((key) => key.toLowerCase() === normalizedLocale.toLowerCase()) ??
    localeKeys.find(
      (key) => key.split('-')[0].toLowerCase() === normalizedLocale.split('-')[0].toLowerCase()
    );
  const copies = workoutTemplateCopiesByLocale[matchingLocale ?? 'en-US'];

  return applyWorkoutTemplateCopies(workoutTemplatesData as RawWorkoutTemplateDefinition[], copies);
}

export const workoutTemplates = getWorkoutTemplates();
