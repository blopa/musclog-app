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

export type WorkoutTemplateCopy = Pick<RawWorkoutTemplate, 'title' | 'description' | 'dayNames'>;

export function applyWorkoutTemplateCopies(
  templates: RawWorkoutTemplate[],
  copies: WorkoutTemplateCopy[]
): RawWorkoutTemplate[] {
  return templates.map((template, index) => ({ ...template, ...copies[index] }));
}

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

  return applyWorkoutTemplateCopies(workoutTemplatesData as RawWorkoutTemplate[], copies);
}

export const workoutTemplates = getWorkoutTemplates();
