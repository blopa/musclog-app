import { getExerciseCatalogue } from '@/data/exerciseCatalogue';
import workoutTemplatesData from '@/data/workoutTemplatesData.json';
import { parseWorkoutPlanText } from '@/utils/aiWorkoutPlan/parse';
import { parseOpenLink } from '@/utils/openLink';

import {
  PROGRAM_SLUGS,
  PROGRAM_SLUGS_BY_TEMPLATE_TITLE,
  programPath,
  SAFE_PROGRAM_SLUG,
} from '../../programRoutes';
import { getProgram, listPrograms, programOpenUrl, programToPlanDocument } from '../programsModel';

const LOCALES = ['en-US', 'es-ES', 'nl-NL', 'pt-BR', 'ru-RU'];
const dayLabel = (position: number) => `Day ${position}`;

describe('program slugs', () => {
  const titles = (workoutTemplatesData as { __title: string }[]).map(
    (template) => template.__title
  );

  it('gives every bundled template exactly one slug and every slug a template', () => {
    expect(new Set(Object.keys(PROGRAM_SLUGS_BY_TEMPLATE_TITLE))).toEqual(new Set(titles));
    expect(new Set(PROGRAM_SLUGS).size).toBe(titles.length);
  });

  it('only uses URL-safe slugs', () => {
    for (const slug of PROGRAM_SLUGS) {
      expect(slug).toMatch(SAFE_PROGRAM_SLUG);
      expect(programPath(slug)).toBe(`/programs/${slug}`);
    }

    expect(() => programPath('Bad Slug')).toThrow();
  });
});

describe.each(LOCALES)('programs in %s', (locale) => {
  const programs = listPrograms(locale);
  const catalogue = new Set(getExerciseCatalogue(locale).map((entry) => entry.exerciseSlug));

  it('lists every program once, in slug-table order', () => {
    expect(programs.map((program) => program.slug)).toEqual([...PROGRAM_SLUGS]);
  });

  it('gives each program a title, days and named exercises with usable numbers', () => {
    for (const program of programs) {
      expect(program.title.length).toBeGreaterThan(0);
      expect(program.days.length).toBeGreaterThan(0);
      for (const day of program.days) {
        expect(day.exercises.length).toBeGreaterThan(0);
        for (const exercise of day.exercises) {
          expect(catalogue.has(exercise.exerciseSlug)).toBe(true);
          expect(exercise.name.length).toBeGreaterThan(0);
          expect(exercise.sets).toBeGreaterThan(0);
          expect(exercise.reps).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('open links', () => {
  const programs = listPrograms('en-US');

  it.each(programs.map((program) => [program.slug, program] as const))(
    'the %s link is a plan the app accepts, with the same exercises',
    (_slug, program) => {
      const url = programOpenUrl(program, dayLabel);
      const parsed = parseOpenLink(url);
      expect(parsed).toMatchObject({ matches: true, link: { kind: 'workout' } });

      const result = parseWorkoutPlanText(url);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.skippedExercises).toBe(0);
        expect(result.plan.workouts).toHaveLength(program.days.length);
        expect(result.plan.workouts.map((workout) => workout.exercises.length)).toEqual(
          program.days.map((day) => day.exercises.length)
        );
        expect(result.plan.workouts[0].exercises[0].exerciseSlug).toBe(
          program.days[0].exercises[0].exerciseSlug
        );
      }
    }
  );

  it('keeps the program days named by the program, and numbers the rest', () => {
    const cable = getProgram('cable-superset-workout', 'en-US')!;
    expect(programToPlanDocument(cable, dayLabel).workouts.map((workout) => workout.name)).toEqual([
      'Upper A',
      'Lower A',
      'Arms',
      'Upper B',
      'Lower B',
    ]);
    const ppl = getProgram('push-pull-legs', 'en-US')!;
    expect(programToPlanDocument(ppl, dayLabel).workouts.map((workout) => workout.name)).toEqual([
      'Day 1',
      'Day 2',
      'Day 3',
    ]);
  });

  it('keeps rep ranges and rest on the document', () => {
    const cable = getProgram('cable-superset-workout', 'en-US')!;
    const first = programToPlanDocument(cable, dayLabel).workouts[0].exercises[0];
    expect(first).toMatchObject({
      sets: 4,
      minReps: 4,
      reps: 6,
      restSeconds: 45,
      supersetGroup: 'A',
    });
  });

  it('returns null for an unknown slug', () => {
    expect(getProgram('nope', 'en-US')).toBeNull();
  });
});
