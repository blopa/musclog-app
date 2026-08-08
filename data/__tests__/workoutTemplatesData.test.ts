import exercisesData from '@/data/exercisesData.json';
import workoutTemplatesData from '@/data/workoutTemplatesData.json';
import {
  applyWorkoutTemplateCopies,
  getWorkoutTemplates,
  workoutTemplates,
} from '@/data/workoutTemplates';
import workoutTemplatesEnUs from '@/data/workoutTemplatesEnUS.json';
import workoutTemplatesEsEs from '@/data/workoutTemplatesEsEs.json';
import workoutTemplatesNlNl from '@/data/workoutTemplatesNlNl.json';
import workoutTemplatesPtBr from '@/data/workoutTemplatesPtBr.json';
import workoutTemplatesRuRu from '@/data/workoutTemplatesRuRu.json';
import { WORKOUT_TEMPLATE_COPIES_BY_LOCALE } from '@/lang/lang';

describe('workout template copies', () => {
  it('generates the locale catalog from the localized workout template files', () => {
    expect(WORKOUT_TEMPLATE_COPIES_BY_LOCALE).toEqual({
      'en-US': workoutTemplatesEnUs,
      'es-ES': workoutTemplatesEsEs,
      'nl-NL': workoutTemplatesNlNl,
      'pt-BR': workoutTemplatesPtBr,
      'ru-RU': workoutTemplatesRuRu,
    });
  });

  it('overlays localized copy without losing the workout definition', () => {
    const [template] = applyWorkoutTemplateCopies(
      [
        {
          __title: 'Reference title',
          duration: 45,
          exercises: [{ exerciseId: 1, day: 1, sets: 3, reps: 8 }],
        },
      ],
      [{ title: 'Localized title', description: 'Localized description' }]
    );

    expect(template).toEqual({
      title: 'Localized title',
      description: 'Localized description',
      duration: 45,
      exercises: [{ exerciseId: 1, day: 1, sets: 3, reps: 8 }],
    });
  });

  it('never surfaces the reference title from the definition file', () => {
    expect(applyWorkoutTemplateCopies([{ __title: 'Reference title', duration: 30 }], [])).toEqual([
      { title: '', duration: 30 },
    ]);
    expect(workoutTemplates.every((template) => !('__title' in template))).toBe(true);
  });

  it.each([
    ['en-US', workoutTemplatesEnUs],
    ['es-ES', workoutTemplatesEsEs],
    ['nl-NL', workoutTemplatesNlNl],
    ['pt-BR', workoutTemplatesPtBr],
    ['ru-RU', workoutTemplatesRuRu],
  ])('keeps the %s catalog aligned with the workout definitions', (_locale, copies) => {
    expect(copies).toHaveLength(workoutTemplates.length);
    expect(copies.every(({ title }) => title.trim().length > 0)).toBe(true);
    expect(copies.every((copy) => !('difficulty' in copy))).toBe(true);
  });

  it('keeps canonical difficulty identifiers in structural data only', () => {
    expect(new Set(workoutTemplatesData.map(({ difficulty }) => difficulty))).toEqual(
      new Set(['beginner', 'intermediate', 'advanced'])
    );
    expect(workoutTemplates.every(({ difficulty }) => difficulty !== undefined)).toBe(true);
  });

  it.each([
    ['es-ES', 'Rutina dividida de hipertrofia de 5 días', 'Torso A'],
    ['nl-NL', '5-daagse hypertrofiesplit', 'Bovenlichaam A'],
    ['pt-BR', 'Divisão de hipertrofia de 5 dias', 'Superior A'],
    ['ru-RU', '5-дневный сплит на гипертрофию', 'Верх A'],
  ])('selects localized copies for %s', (locale, expectedTitle, expectedFirstDay) => {
    const templates = getWorkoutTemplates(locale);

    expect(templates[0].title).toBe(expectedTitle);
    expect(templates[0].exercises).toEqual(workoutTemplates[0].exercises);
    expect(templates[11].description).toBeTruthy();
    expect(templates[11].dayNames?.['1']).toBe(expectedFirstDay);
  });

  it('supports base language and underscore locale variants', () => {
    expect(getWorkoutTemplates('es')[0].title).toBe(workoutTemplatesEsEs[0].title);
    expect(getWorkoutTemplates('es-MX')[0].title).toBe(workoutTemplatesEsEs[0].title);
    expect(getWorkoutTemplates('pt_BR')[0].title).toBe(workoutTemplatesPtBr[0].title);
  });

  it('falls back to English copies for unsupported locales', () => {
    expect(getWorkoutTemplates('fr-FR')[0].title).toBe(workoutTemplatesEnUs[0].title);
  });
});

describe('Cable Superset Workout', () => {
  const program = workoutTemplates.find(({ title }) => title === 'Cable Superset Workout');

  it('ships the five training sessions from the seven-day split', () => {
    expect(program).toBeDefined();
    expect([...new Set(program?.exercises.map(({ day }) => day))]).toEqual([1, 2, 3, 5, 6]);
    expect(program?.dayNames).toEqual({
      '1': 'Upper A',
      '2': 'Lower A',
      '3': 'Arms',
      '5': 'Upper B',
      '6': 'Lower B',
    });
    expect(program?.exercises).toHaveLength(33);
  });

  it('keeps every paired movement in a two-exercise superset group', () => {
    if (!program) {
      throw new Error('Cable Superset Workout is missing');
    }

    const groups = new Map<string, typeof program.exercises>();
    for (const exercise of program.exercises) {
      if (!exercise.supersetGroup) {
        continue;
      }

      const key = `${exercise.day}-${exercise.supersetGroup}`;
      groups.set(key, [...(groups.get(key) ?? []), exercise]);
    }

    expect([...groups.values()].every((exercises) => exercises.length === 2)).toBe(true);
    expect(program.exercises.filter(({ supersetGroup }) => supersetGroup)).toHaveLength(28);

    expect(groups.get('5-C')?.map(({ sets }) => sets)).toEqual([2, 3]);
    expect(groups.get('6-B')?.map(({ sets }) => sets)).toEqual([3, 4]);
  });

  it('references bundled exercises and includes valid progression/rest targets', () => {
    if (!program) {
      throw new Error('Cable Superset Workout is missing');
    }

    const exerciseIds = new Set(exercisesData.map(({ exerciseIndex }) => exerciseIndex));

    for (const exercise of program.exercises) {
      expect(exerciseIds.has(exercise.exerciseId)).toBe(true);
      expect(exercise.minReps).toBeLessThanOrEqual(exercise.reps);
      expect(exercise.restTimeAfter).toBeGreaterThan(0);
      expect(exercise.notes).toEqual(expect.any(String));
    }
  });
});
