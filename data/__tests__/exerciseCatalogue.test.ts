import { getExerciseCatalogue } from '@/data/exerciseCatalogue';

jest.mock('@/data/exercisesData.json', () => [
  {
    __freeExerciseDbId: 'First_Slug',
    equipmentType: 'barbell',
    exerciseIndex: 1,
    loadMultiplier: 1,
    mechanicType: 'compound',
    muscleGroup: 'chest',
    targetMuscles: ['pectoralis_major'],
  },
  {
    __freeExerciseDbId: 'Second_Slug',
    equipmentType: 'bodyweight',
    exerciseIndex: 2,
    loadMultiplier: 0.7,
    mechanicType: 'compound',
    muscleGroup: 'arms',
    targetMuscles: ['triceps'],
  },
]);

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { language: 'en-US', resolvedLanguage: 'en-US' },
  EN_US: 'en-US',
  EXERCISES_JSON: {
    'en-US': [
      { description: 'second description', exerciseSlug: 'Second_Slug', name: 'Second name' },
      { description: 'first description', exerciseSlug: 'First_Slug', name: 'First name' },
    ],
  },
}));

describe('getExerciseCatalogue', () => {
  it('joins localized copy by slug even when copy order changes', () => {
    expect(
      getExerciseCatalogue('en-US').map(({ description, exerciseSlug, name }) => ({
        description,
        exerciseSlug,
        name,
      }))
    ).toEqual([
      {
        description: 'first description',
        exerciseSlug: 'First_Slug',
        name: 'First name',
      },
      {
        description: 'second description',
        exerciseSlug: 'Second_Slug',
        name: 'Second name',
      },
    ]);
  });
});
