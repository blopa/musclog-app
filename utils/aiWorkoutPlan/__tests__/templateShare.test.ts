import { OPEN_LINK_SUGGESTED_MAX_CHARS, parseOpenLink } from '@/utils/openLink';

import { planDocumentSchema } from '../contract';
import { parseWorkoutPlanText } from '../parse';
import { buildTemplateShare, templateToPlanDocument } from '../templateShare';

const set = (targetReps: number, extra: Record<string, unknown> = {}) => ({
  targetReps,
  ...extra,
});

describe('templateToPlanDocument', () => {
  it('builds a document the plan contract accepts, from catalogue exercises only', () => {
    const built = templateToPlanDocument({
      name: ' Push day ',
      description: 'Chest and triceps',
      exercises: [
        {
          exerciseId: 'fx-Barbell_Bench_Press_-_Medium_Grip',
          notes: ' pause on the chest ',
          sets: [set(8, { restTimeAfter: 90 }), set(10), set(12)],
        },
        { exerciseId: 'custom-123', sets: [set(10)] },
        { exerciseId: 'fx-Triceps_Pushdown', sets: [set(12, { setType: 'warmup' })] },
      ],
    });

    expect(built?.skippedExercises).toBe(2);
    expect(planDocumentSchema.safeParse(built?.document).success).toBe(true);
    expect(built?.document).toMatchObject({
      title: 'Push day',
      description: 'Chest and triceps',
      workouts: [
        {
          name: 'Push day',
          exercises: [
            {
              exerciseSlug: 'Barbell_Bench_Press_-_Medium_Grip',
              sets: 3,
              reps: 12,
              minReps: 8,
              restSeconds: 90,
              notes: 'pause on the chest',
            },
          ],
        },
      ],
    });
  });

  it('gives each shared group a label and keeps warm-ups out of the set count', () => {
    const built = templateToPlanDocument({
      name: 'Arms',
      exercises: [
        {
          exerciseId: 'fx-Dumbbell_Bicep_Curl',
          groupId: 'a',
          sets: [set(10, { setType: 'warmup' }), set(10), set(10)],
        },
        { exerciseId: 'fx-Triceps_Pushdown', groupId: 'a', sets: [set(12), set(12)] },
        { exerciseId: 'fx-Hammer_Curls', groupId: 'b', sets: [set(12)] },
      ],
    });
    const exercises = (built?.document.workouts as { exercises: Record<string, unknown>[] }[])[0]
      .exercises;

    expect(exercises.map((exercise) => exercise.sets)).toEqual([2, 2, 1]);
    expect(exercises.map((exercise) => exercise.supersetGroup)).toEqual(['1', '1', '2']);
  });

  it('returns null when nothing can travel', () => {
    expect(
      templateToPlanDocument({ name: 'Mine', exercises: [{ exerciseId: 'x', sets: [set(5)] }] })
    ).toBeNull();
    expect(templateToPlanDocument({ name: 'Empty', exercises: [] })).toBeNull();
  });

  it('keeps every number inside the contract bounds', () => {
    const built = templateToPlanDocument({
      name: 'x'.repeat(200),
      exercises: [
        {
          exerciseId: 'fx-Leg_Press',
          sets: [set(500, { restTimeAfter: 99999 }), ...Array.from({ length: 14 }, () => set(0))],
        },
      ],
    });

    expect(planDocumentSchema.safeParse(built?.document).success).toBe(true);
  });
});

describe('buildTemplateShare', () => {
  const template = {
    name: 'Legs (heavy) & more',
    exercises: [{ exerciseId: 'fx-Barbell_Squat', sets: [set(8), set(8), set(8)] }],
  };

  it('is an open link the app and the review parse back into the same plan', () => {
    const share = buildTemplateShare(template);

    expect(share?.url.startsWith('https://musclog.app/open#workout=')).toBe(true);
    expect(share?.url).not.toMatch(/[()'!*]/);

    const link = parseOpenLink(share!.url);
    expect(link).toMatchObject({ matches: true, link: { kind: 'workout' } });

    const parsed = parseWorkoutPlanText(share!.url);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.plan.title).toBe('Legs (heavy) & more');
    expect(parsed.ok && parsed.plan.workouts[0].exercises[0]).toMatchObject({
      exerciseSlug: 'Barbell_Squat',
      sets: 3,
      reps: 8,
    });
  });

  it('is null when the link would be too long to share', () => {
    const big = {
      name: 'Big',
      exercises: Array.from({ length: 20 }, () => ({
        exerciseId: 'fx-Barbell_Squat',
        notes: 'é'.repeat(200),
        sets: [set(8)],
      })),
    };

    expect(buildTemplateShare(big)).toBeNull();
    expect(OPEN_LINK_SUGGESTED_MAX_CHARS).toBeGreaterThan(0);
  });
});
