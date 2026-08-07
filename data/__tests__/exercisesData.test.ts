import exercisesData from '@/data/exercisesData.json';
import exercisesEnUS from '@/data/exercisesEnUS.json';
import exercisesEsEs from '@/data/exercisesEsEs.json';
import exercisesNlNl from '@/data/exercisesNlNl.json';
import exercisesPtBr from '@/data/exercisesPtBr.json';
import exercisesRuRu from '@/data/exercisesRuRu.json';

const bodyCraftCableExercises = [
  'Cable Bulgarian Split Squat',
  'Cable Romanian Deadlift',
  'Cable Standing Calf Raise',
  'Cable Bayesian Curl',
  'Cable Cross-Body Triceps Extension',
  'Cable Wrist Curl',
  'Cable Reverse Wrist Curl',
  'Cable Belt Squat',
  'Cable Low-to-High Fly',
];

describe('BodyCraft cable exercises', () => {
  it('includes every exercise as cable equipment with a cable-prefixed canonical name', () => {
    const additions = exercisesData.filter(({ __exerciseName }) =>
      bodyCraftCableExercises.includes(__exerciseName)
    );

    expect(additions).toHaveLength(bodyCraftCableExercises.length);
    expect(additions.map(({ __exerciseName }) => __exerciseName)).toEqual(bodyCraftCableExercises);
    expect(additions.every(({ equipmentType }) => equipmentType === 'cable')).toBe(true);
    expect(additions.every(({ __exerciseName }) => __exerciseName.startsWith('Cable '))).toBe(true);
  });

  it.each([
    ['en-US', exercisesEnUS],
    ['es-ES', exercisesEsEs],
    ['nl-NL', exercisesNlNl],
    ['pt-BR', exercisesPtBr],
    ['ru-RU', exercisesRuRu],
  ])('keeps the %s catalog aligned with the canonical exercise indexes', (_locale, catalog) => {
    for (let exerciseIndex = 248; exerciseIndex <= 256; exerciseIndex += 1) {
      expect(catalog[exerciseIndex - 1]).toMatchObject({
        exerciseIndex,
        name: expect.any(String),
        description: expect.any(String),
      });
    }
  });
});
