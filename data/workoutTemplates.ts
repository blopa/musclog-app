import workoutTemplatesData from '@/data/workoutTemplatesData.json';
import { DEFAULT_LANG, WORKOUT_TEMPLATE_COPIES_BY_LOCALE } from '@/lang/lang';

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
  exerciseSlug?: string;
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

type WorkoutTemplateLocale = keyof typeof WORKOUT_TEMPLATE_COPIES_BY_LOCALE;

export function applyWorkoutTemplateCopies(
  templates: RawWorkoutTemplateDefinition[],
  copies: WorkoutTemplateCopy[]
): RawWorkoutTemplate[] {
  return templates.map(({ __title, ...template }, index) => {
    const copy: undefined | WorkoutTemplateCopy = copies[index];
    return { ...template, ...copy, title: copy?.title ?? '' };
  });
}

export function getWorkoutTemplates(locale = DEFAULT_LANG): RawWorkoutTemplate[] {
  const normalizedLocale = locale.replace('_', '-');
  const localeKeys = Object.keys(WORKOUT_TEMPLATE_COPIES_BY_LOCALE) as WorkoutTemplateLocale[];
  const matchingLocale =
    localeKeys.find((key) => key.toLowerCase() === normalizedLocale.toLowerCase()) ??
    localeKeys.find(
      (key) => key.split('-')[0].toLowerCase() === normalizedLocale.split('-')[0].toLowerCase()
    );
  const copies = WORKOUT_TEMPLATE_COPIES_BY_LOCALE[matchingLocale ?? DEFAULT_LANG];

  return applyWorkoutTemplateCopies(workoutTemplatesData as RawWorkoutTemplateDefinition[], copies);
}

export const workoutTemplates = getWorkoutTemplates();
