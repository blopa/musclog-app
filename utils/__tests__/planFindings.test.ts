import type {
  CalculateVolumeResponse,
  GenerateMealPlanResponse,
  GenerateWorkoutPlanResponse,
} from '../coachAI';
import { mealPlanFindings, workoutPlanFindings, workoutVolumeFindings } from '../planFindings';

const exercise = (exerciseId: string, sets = 3, reps = 8) => ({
  exerciseId,
  sets,
  reps,
  oneRepMaxPercentage: 75,
});

describe('workoutPlanFindings', () => {
  it('finds nothing in a sound plan', () => {
    const plan: GenerateWorkoutPlanResponse = {
      planTitle: 'Push pull',
      description: '',
      workoutPlan: [
        { title: 'Push', recurringOnWeekDay: 'monday', exercises: [exercise('1'), exercise('2')] },
      ],
    };
    expect(workoutPlanFindings(plan)).toEqual([]);
  });

  it('finds empty plans, empty workouts, repeats and impossible numbers', () => {
    expect(workoutPlanFindings({ planTitle: 'x', description: '', workoutPlan: [] })).toEqual([
      'The plan has no workouts.',
    ]);

    const findings = workoutPlanFindings({
      planTitle: 'x',
      description: '',
      workoutPlan: [
        { title: 'Legs', recurringOnWeekDay: 'monday', exercises: [] },
        {
          title: 'Push',
          recurringOnWeekDay: 'tuesday',
          exercises: [
            exercise('1'),
            exercise('1', 0, 80),
            { ...exercise('2'), oneRepMaxPercentage: 140 },
          ],
        },
      ],
    });
    expect(findings).toEqual([
      '"Legs" has no exercises.',
      '"Push" lists exercise 1 more than once.',
      '"Push": exercise 1 has 0 sets.',
      '"Push": exercise 1 has 80 reps.',
      '"Push": exercise 2 is at 140% of one-rep max.',
    ]);
  });
});

describe('mealPlanFindings', () => {
  const ingredient = (kcal: number, protein: number) => ({
    name: 'chicken',
    grams: 200,
    kcal,
    protein,
    carbs: 0,
    fat: (kcal - protein * 4) / 9,
  });
  const plan = (...days: [number, number, number][]): GenerateMealPlanResponse => ({
    description: '',
    meals: days.map(([day, kcal, protein]) => ({
      day,
      mealType: 'lunch',
      name: 'Lunch',
      description: '',
      ingredients: [ingredient(kcal, protein)],
    })),
  });

  it('checks each day against the targets it was asked for, within 10%', () => {
    const targets = { calories: 400, protein: 60 };
    expect(mealPlanFindings(plan([1, 420, 58]), targets)).toEqual([]);
    expect(mealPlanFindings(plan([1, 420, 58], [2, 300, 40]), targets)).toEqual([
      'Day 2 has 300 kcal; the target is 400.',
      'Day 2 has 40 g protein; the target is 60.',
    ]);
  });

  it('checks no targets that were not asked for', () => {
    expect(mealPlanFindings(plan([1, 300, 40]))).toEqual([]);
  });

  it('finds meals with no ingredients and numbers that do not add up', () => {
    expect(
      mealPlanFindings({
        description: '',
        meals: [
          { day: 1, mealType: 'snack', name: 'Snack', description: '', ingredients: [] },
          {
            day: 1,
            mealType: 'lunch',
            name: 'Lunch',
            description: '',
            ingredients: [{ name: 'rice', grams: 100, kcal: 900, protein: 2, carbs: 28, fat: 0.3 }],
          },
        ],
      })
    ).toEqual([
      'Day 1, "Snack" has no ingredients.',
      'Day 1, "Lunch": the numbers of rice do not add up.',
    ]);
  });
});

describe('workoutVolumeFindings', () => {
  it('finds missing sets, too many sets and impossible reps or weights', () => {
    const volume: CalculateVolumeResponse = {
      messageToUser: '',
      workoutVolume: [
        { exerciseId: 1, sets: [] },
        {
          exerciseId: 2,
          sets: [
            { setId: 1, reps: 8, weight: 60 },
            { setId: 2, reps: 0, weight: -5 },
          ],
        },
        {
          exerciseId: 3,
          sets: Array.from({ length: 11 }, (_, i) => ({ setId: i, reps: 5, weight: 50 })),
        },
      ],
    };
    expect(workoutVolumeFindings(volume)).toEqual([
      'Exercise 1 has no sets.',
      'Exercise 2, set 2 has 0 reps.',
      'Exercise 2, set 2 has a weight of -5.',
      'Exercise 3 has 11 sets.',
    ]);
  });
});
