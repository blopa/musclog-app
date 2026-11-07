import exercisesData from '@/data/exercisesData.json';
import {
  buildOpenHttpsUrl,
  OPEN_LINK_BASE_URL,
  OPEN_LINK_SUGGESTED_MAX_CHARS,
} from '@/utils/openLink';
import { MAX_PLAN_BYTES, PLAN_MAJOR, PLAN_SCHEMA_ID, planDocumentSchema } from '../contract';
import {
  buildPlanJsonSchema,
  buildWorkoutPlanInstructions,
  WORKOUT_INSTRUCTIONS_REVISION,
  WORKOUT_PLAN_FILE_NAME,
} from '../instructions';
import { parseWorkoutPlanText } from '../parse';
import { type CatalogueNames, resolvePlanExercises } from '../resolveExercises';
import { planToRawTemplate } from '../toTemplate';

const SLUGS = (exercisesData as { __freeExerciseDbId: string }[]).map(
  (entry) => entry.__freeExerciseDbId
);

const document = (overrides: Record<string, unknown> = {}) => ({
  schema: PLAN_SCHEMA_ID,
  version: PLAN_MAJOR,
  title: 'Upper / lower',
  workouts: [
    {
      name: 'Upper',
      exercises: [
        { exerciseSlug: 'Barbell_Bench_Press_-_Medium_Grip', sets: 3, reps: 8 },
        { exerciseSlug: 'Barbell_Squat', sets: 4, reps: 6 },
      ],
    },
  ],
  ...overrides,
});

const parse = (value: unknown) => parseWorkoutPlanText(JSON.stringify(value));

const CATALOGUE: CatalogueNames[] = [
  { exerciseSlug: 'Barbell_Squat', names: ['Barbell Squat', 'Agachamento com barra'] },
  { exerciseSlug: 'Barbell_Curl', names: ['Barbell Curl'] },
  { exerciseSlug: 'Dumbbell_Curl_A', names: ['Curl'] },
  { exerciseSlug: 'Dumbbell_Curl_B', names: ['Curl'] },
  { exerciseSlug: '3_4_Sit-Up', names: ['3/4 Sit-Up'] },
];

describe('parseWorkoutPlanText', () => {
  it('reads a plan and keeps the documented fields', () => {
    const result = parse(
      document({
        description: 'Four days',
        difficulty: 'intermediate',
        weekdays: ['Friday', 'monday', 'monday', 'someday'],
      })
    );

    expect(result).toMatchObject({
      ok: true,
      skippedExercises: 0,
      plan: {
        title: 'Upper / lower',
        description: 'Four days',
        difficulty: 'intermediate',
        weekDays: [0, 4],
      },
    });
  });

  it('finds the JSON inside a code fence and a sentence', () => {
    const wrapped = `Here is your plan:\n\`\`\`json\n${JSON.stringify(document())}\n\`\`\`\nEnjoy!`;

    expect(parseWorkoutPlanText(wrapped).ok).toBe(true);
  });

  it('reads a rep range written as text and numbers written as strings', () => {
    const result = parse(
      document({
        workouts: [
          {
            name: 'A',
            exercises: [
              { exerciseSlug: 'Barbell_Squat', sets: '3', reps: '8-12' },
              { exerciseSlug: 'Barbell_Curl', sets: 3, reps: 10, minReps: 15 },
            ],
          },
        ],
      })
    );

    expect(result.ok && result.plan.workouts[0].exercises).toEqual([
      { exerciseSlug: 'Barbell_Squat', sets: 3, reps: 12, minReps: 8 },
      // A bottom that is not below the top is not a range.
      { exerciseSlug: 'Barbell_Curl', sets: 3, reps: 10 },
    ]);
  });

  it('counts exercises it cannot use instead of repairing them', () => {
    const result = parse(
      document({
        workouts: [
          {
            name: 'A',
            exercises: [
              { exerciseSlug: 'Barbell_Squat', sets: 3, reps: 8 },
              { exerciseSlug: 'Barbell_Curl', sets: 0, reps: 8 },
              { exerciseSlug: 'Barbell_Curl', sets: 3, reps: 'many' },
              { sets: 3, reps: 8 },
              'Barbell_Curl',
            ],
          },
        ],
      })
    );

    expect(result).toMatchObject({ ok: true, skippedExercises: 4 });
    expect(result.ok && result.plan.workouts[0].exercises).toHaveLength(1);
  });

  it('ignores stray keys and bounds long text', () => {
    const result = parse(
      document({ title: 'x'.repeat(300), loads: { squat: 100 }, difficulty: 'impossible' })
    );

    expect(result.ok && result.plan.title).toHaveLength(80);
    expect(result.ok && result.plan.difficulty).toBeUndefined();
  });

  it('drops a workout with no usable exercises and refuses a plan with none left', () => {
    const empty = {
      name: 'Empty',
      exercises: [{ exerciseSlug: 'Barbell_Squat', sets: 0, reps: 8 }],
    };
    const kept = document().workouts;

    expect(parse(document({ workouts: [empty, ...kept] }))).toMatchObject({
      ok: true,
      skippedExercises: 1,
    });
    expect(parse(document({ workouts: [empty] }))).toEqual({ ok: false, error: 'noExercises' });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['just words, no braces', 'notJson'],
    ['{ "schema": ', 'notJson'],
    ['[1, 2]', 'notJson'],
    [JSON.stringify({ schema: 'musclog-onboarding', version: 1 }), 'wrongSchema'],
    [JSON.stringify({ schema: PLAN_SCHEMA_ID, version: 'one' }), 'invalidVersion'],
    [JSON.stringify({ schema: PLAN_SCHEMA_ID, version: 0 }), 'invalidVersion'],
    [JSON.stringify({ schema: PLAN_SCHEMA_ID, version: PLAN_MAJOR + 1 }), 'newerVersion'],
    [JSON.stringify(document({ title: '  ' })), 'invalidPlan'],
    [JSON.stringify(document({ workouts: [] })), 'invalidPlan'],
    [JSON.stringify(document({ workouts: 'none' })), 'invalidPlan'],
  ])('refuses %j as %s', (text, error) => {
    expect(parseWorkoutPlanText(text)).toEqual({ ok: false, error });
  });

  it('refuses a file that is too large before parsing it', () => {
    expect(parseWorkoutPlanText(' '.repeat(MAX_PLAN_BYTES) + '{}')).toEqual({
      ok: false,
      error: 'tooLarge',
    });
  });

  it('caps the number of workouts and exercises', () => {
    const exercise = { exerciseSlug: 'Barbell_Squat', sets: 3, reps: 8 };
    const workout = { name: 'A', exercises: Array.from({ length: 30 }, () => exercise) };
    const result = parse(document({ workouts: Array.from({ length: 12 }, () => workout) }));

    expect(result.ok && result.plan.workouts).toHaveLength(7);
    expect(result.ok && result.plan.workouts[0].exercises).toHaveLength(20);
  });
});

describe('resolvePlanExercises', () => {
  const plan = (slugs: string[]) => {
    const parsed = parse(
      document({
        workouts: [
          {
            name: 'A',
            exercises: slugs.map((exerciseSlug) => ({ exerciseSlug, sets: 3, reps: 8 })),
          },
        ],
      })
    );
    if (!parsed.ok) {
      throw new Error('fixture must parse');
    }

    return parsed.plan;
  };

  it('matches an exact slug, a differently spelled slug and a name in another language', () => {
    const { workouts, unmatched } = resolvePlanExercises(
      plan(['Barbell_Squat', '3/4 sit-up', 'agachamento com barra', 'barbell curl']),
      CATALOGUE
    );

    // Barbell_Squat and its Portuguese name are one exercise, so it appears once.
    expect(workouts[0].exercises.map((exercise) => exercise.exerciseSlug)).toEqual([
      'Barbell_Squat',
      '3_4_Sit-Up',
      'Barbell_Curl',
    ]);
    expect(unmatched).toEqual([]);
  });

  it('reports an unknown name and an ambiguous one instead of guessing', () => {
    const { workouts, unmatched } = resolvePlanExercises(
      plan(['Barbell_Squat', 'Zottman curl', 'Curl']),
      CATALOGUE
    );

    expect(workouts[0].exercises).toHaveLength(1);
    expect(unmatched).toEqual([
      { requested: 'Zottman curl', workoutIndex: 0 },
      { requested: 'Curl', workoutIndex: 0 },
    ]);
  });

  it('drops a workout whose exercises were all unmatched', () => {
    const { workouts, unmatched } = resolvePlanExercises(plan(['nothing here']), CATALOGUE);

    expect(workouts).toEqual([]);
    expect(unmatched).toHaveLength(1);
  });

  it('resolves every slug the catalogue ships', () => {
    const catalogue = SLUGS.map((exerciseSlug) => ({ exerciseSlug, names: [] }));
    const sample = SLUGS.filter((_, index) => index % 7 === 0).slice(0, 20);
    const { workouts, unmatched } = resolvePlanExercises(plan(sample), catalogue);

    expect(unmatched).toEqual([]);
    expect(workouts[0].exercises.map((exercise) => exercise.exerciseSlug)).toEqual(sample);
  });
});

describe('planToRawTemplate', () => {
  const resolved = (extra: Record<string, unknown> = {}) => {
    const parsed = parse(
      document({
        description: 'A plan',
        difficulty: 'beginner',
        workouts: [
          {
            name: 'Push',
            exercises: [
              {
                exerciseSlug: 'Barbell_Squat',
                sets: 3,
                reps: '8-12',
                restSeconds: 90,
                notes: 'Brace',
                supersetGroup: 'A',
              },
            ],
          },
          { exercises: [{ exerciseSlug: 'Barbell_Curl', sets: 2, reps: 15 }] },
        ],
        ...extra,
      })
    );
    if (!parsed.ok) {
      throw new Error('fixture must parse');
    }

    return resolvePlanExercises(parsed.plan, CATALOGUE);
  };

  it('numbers the days, names only the workouts that have a name and keeps the details', () => {
    const { plan, workouts } = resolved();
    const { template, options } = planToRawTemplate(plan, workouts);

    expect(template).toEqual({
      title: 'Upper / lower',
      description: 'A plan',
      difficulty: 'beginner',
      dayNames: { '1': 'Push' },
      exercises: [
        {
          exerciseSlug: 'Barbell_Squat',
          day: 1,
          sets: 3,
          reps: 12,
          minReps: 8,
          restTimeAfter: 90,
          notes: 'Brace',
          supersetGroup: 'A',
        },
        { exerciseSlug: 'Barbell_Curl', day: 2, sets: 2, reps: 15 },
      ],
    });
    expect(options).toEqual({});
  });

  it('makes a weekly plan only when the file named weekdays', () => {
    const { plan, workouts } = resolved({ weekdays: ['wednesday', 'monday'] });

    expect(planToRawTemplate(plan, workouts).options).toEqual({
      cycleType: 'weekly',
      weekDays: [0, 2],
    });
  });

  it('renumbers days after an unmatched workout was dropped', () => {
    const { plan } = resolved();
    const { template } = planToRawTemplate(plan, [
      { name: 'Only', exercises: [{ exerciseSlug: 'Barbell_Curl', sets: 2, reps: 15 }] },
    ]);

    expect(template.dayNames).toEqual({ '1': 'Only' });
    expect(template.exercises).toEqual([
      { exerciseSlug: 'Barbell_Curl', day: 1, sets: 2, reps: 15 },
    ]);
  });
});

describe('parseWorkoutPlanText with an open link', () => {
  const json = JSON.stringify(document());
  const link = buildOpenHttpsUrl({ kind: 'workout', payload: json });

  it.each([
    ['a bare link', link],
    ['a markdown link', `[Open in Musclog](${link})`],
    [
      'a whole message with the link and the block',
      `Done!\n[Open in Musclog](${link})\n\n\`\`\`json\n${json}\n\`\`\``,
    ],
  ])('reads %s', (_name, text) => {
    expect(parseWorkoutPlanText(text)).toMatchObject({
      ok: true,
      plan: { title: 'Upper / lower' },
    });
  });

  it('reads a link the prompt rule produced (Python quote with safe="")', () => {
    // urllib.parse.quote(minified, safe='') escapes everything but A-Za-z0-9_.-~
    const python = json.replace(/[^A-Za-z0-9_.\-~]/g, (character) =>
      Array.from(
        Buffer.from(character, 'utf8'),
        (byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
      ).join('')
    );
    expect(parseWorkoutPlanText(`[Open](${OPEN_LINK_BASE_URL}#workout=${python})`)).toMatchObject({
      ok: true,
    });
  });

  it('falls back to the JSON block when the link is damaged', () => {
    const damaged = `${OPEN_LINK_BASE_URL}#workout=%7B%22broken`;
    const text = `[Open in Musclog](${damaged})\n\n\`\`\`json\n${json}\n\`\`\``;

    expect(parseWorkoutPlanText(text)).toMatchObject({ ok: true });
  });

  it('reports the link problem when there is no usable block either', () => {
    expect(parseWorkoutPlanText(`${OPEN_LINK_BASE_URL}#workout=%7B%22broken`)).toEqual({
      ok: false,
      error: 'notJson',
    });
  });

  it('refuses a food link as the wrong document', () => {
    const food = buildOpenHttpsUrl({ kind: 'food', payload: json });
    expect(parseWorkoutPlanText(food)).toEqual({ ok: false, error: 'wrongSchema' });
  });

  it('applies the size cap to the decoded payload, not to the message around it', () => {
    const prose = 'chat '.repeat(2000);
    expect(parseWorkoutPlanText(`${prose}${link}`)).toMatchObject({ ok: true });

    const big = buildOpenHttpsUrl({ kind: 'workout', payload: ' '.repeat(MAX_PLAN_BYTES + 1) });
    expect(parseWorkoutPlanText(big)).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('bounds the scan of a huge paste', () => {
    expect(parseWorkoutPlanText('x'.repeat(MAX_PLAN_BYTES * 4 + 1))).toEqual({
      ok: false,
      error: 'tooLarge',
    });
  });
});

describe('buildWorkoutPlanInstructions', () => {
  const text = buildWorkoutPlanInstructions({ language: 'pt-BR', exerciseSlugs: SLUGS });

  it('carries the revision, the language, the file name and the embedded schema', () => {
    expect(text).toContain(`revision ${WORKOUT_INSTRUCTIONS_REVISION}`);
    expect(text).toContain('"pt-BR"');
    expect(text).toContain(WORKOUT_PLAN_FILE_NAME);
    expect(text).toContain(JSON.stringify(buildPlanJsonSchema()));
  });

  it('lists every exercise slug exactly as the app knows it', () => {
    expect(text).toContain(SLUGS.join(','));
    expect(SLUGS.length).toBeGreaterThan(800);
  });

  it('states the rules the brief requires', () => {
    expect(text).toMatch(/at most 2 or 3/);
    expect(text).toMatch(/Never invent/);
    expect(text).toMatch(/confirm/i);
    expect(text).toMatch(/Do not include loads/);
    expect(text).toMatch(/single JSON code block/);
    expect(text).toMatch(/could not validate/);
  });

  it('asks for the open link, its encoding rule and the JSON fallback', () => {
    expect(WORKOUT_INSTRUCTIONS_REVISION).toBe(2);
    expect(text).toContain(`[Open in Musclog](${OPEN_LINK_BASE_URL}#workout=<encoded JSON>)`);
    expect(text).toContain('A-Z a-z 0-9 - _ . ~');
    expect(text).toContain("urllib.parse.quote(minified, safe='')");
    expect(text).toContain(String(OPEN_LINK_SUGGESTED_MAX_CHARS));
    expect(text).toMatch(/Paste JSON/);
    expect(text).toMatch(/phone that has Musclog/);
    expect(text).not.toMatch(/import the file/);
  });

  it('holds nothing about the person and is deterministic', () => {
    expect(text).not.toMatch(/api[_ -]?key/i);
    expect(buildWorkoutPlanInstructions({ language: 'pt-BR', exerciseSlugs: SLUGS })).toBe(text);
  });

  it('describes a schema the sample document satisfies', () => {
    const schema = buildPlanJsonSchema() as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(schema.properties.schema).toEqual({ const: PLAN_SCHEMA_ID });
    expect(schema.required).toEqual(
      expect.arrayContaining(['schema', 'version', 'title', 'workouts'])
    );
    expect(planDocumentSchema.safeParse(document()).success).toBe(true);
    expect(planDocumentSchema.safeParse(document({ loads: 1 })).success).toBe(false);
  });
});
