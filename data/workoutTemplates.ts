import workoutTemplatesData from '@/data/workoutTemplatesData.json';
import workoutTemplatesEnUs from '@/data/workoutTemplatesEnUS.json';
import workoutTemplatesEsEs from '@/data/workoutTemplatesEsEs.json';
import workoutTemplatesNlNl from '@/data/workoutTemplatesNlNl.json';
import workoutTemplatesPtBr from '@/data/workoutTemplatesPtBr.json';
import workoutTemplatesRuRu from '@/data/workoutTemplatesRuRu.json';

export type RawWorkoutTemplate = {
  title: string;
  description?: string;
  difficulty?: string;
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

export function applyWorkoutTemplateCopies(
  templates: RawWorkoutTemplate[],
  copies: Partial<RawWorkoutTemplate>[]
): RawWorkoutTemplate[] {
  return templates.map((template, index) => ({ ...template, ...copies[index] }));
}

const workoutTemplateCopiesByLocale: Record<string, Partial<RawWorkoutTemplate>[]> = {
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
