import workoutTemplatesData from '@/data/workoutTemplatesData.json';
import workoutTemplatesEnUs from '@/data/workoutTemplatesEnUS.json';

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

export const workoutTemplates = applyWorkoutTemplateCopies(
  workoutTemplatesData as RawWorkoutTemplate[],
  workoutTemplatesEnUs as Partial<RawWorkoutTemplate>[]
);
