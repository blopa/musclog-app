import {
  buildPhotoMeal,
  type FoodCandidate,
  LOCAL_FOOD_IDENTIFY_SCHEMA,
  LOCAL_PHOTO_UNMATCHED_FOOD_ID,
  localFoodIdentifyPrompt,
  MAX_IDENTIFIED_FOODS,
  MAX_IDENTIFIED_NAME_CHARS,
  mealTypeForHour,
  mergeFoodsAcrossPhotos,
  parseIdentifiedFoods,
  photoMealName,
  pickFoodMatch,
  voteIdentifiedFoods,
  searchTermsFor,
  tokenize,
} from '../localFoodPhoto';
import { validateAgainstSchema } from '../aiSchemaValidate';

const food = (id: string, name: string): FoodCandidate => ({
  id,
  name,
  kcal: 100,
  protein: 1,
  carbs: 1,
  fat: 1,
  fiber: 0,
});

describe('parseIdentifiedFoods', () => {
  it('reads names and grams and clamps the grams', () => {
    expect(
      parseIdentifiedFoods({
        items: [
          { name: '  white   rice ', grams: 180.4 },
          { name: 'salt', grams: 0 },
          { name: 'feast', grams: 99999 },
        ],
      })
    ).toEqual([
      { name: 'white rice', grams: 180 },
      { name: 'salt', grams: 5 },
      { name: 'feast', grams: 1500 },
    ]);
  });

  it('defaults a missing weight and merges repeats', () => {
    expect(parseIdentifiedFoods({ items: [{ name: 'Egg' }, { name: 'egg', grams: 50 }] })).toEqual([
      { name: 'Egg', grams: 150 },
    ]);
  });

  it('drops junk and caps the list', () => {
    expect(parseIdentifiedFoods(null)).toEqual([]);
    expect(parseIdentifiedFoods({ items: 'no' })).toEqual([]);
    expect(parseIdentifiedFoods({ items: [null, 3, { name: '' }, { name: 5 }] })).toEqual([]);
    const many = {
      items: Array.from({ length: 40 }, (_, i) => ({ name: `food ${i}`, grams: 10 })),
    };
    expect(parseIdentifiedFoods(many)).toHaveLength(MAX_IDENTIFIED_FOODS);
  });
});

describe('the identify schema', () => {
  it('accepts a good answer and rejects calories-style output', () => {
    expect(
      validateAgainstSchema({ items: [{ name: 'rice', grams: 100 }] }, LOCAL_FOOD_IDENTIFY_SCHEMA)
        .ok
    ).toBe(true);
    expect(
      validateAgainstSchema({ items: [{ name: 'rice' }] }, LOCAL_FOOD_IDENTIFY_SCHEMA).ok
    ).toBe(false);
    expect(validateAgainstSchema({ foods: [] }, LOCAL_FOOD_IDENTIFY_SCHEMA).ok).toBe(false);
  });
});

describe('the identify prompt', () => {
  it('names no example food, because the small model copies examples into its answer', () => {
    const prompt = localFoodIdentifyPrompt();

    expect(prompt).not.toMatch(/such as|e\.g\.|for example/i);
    expect(prompt).not.toMatch(/chicken|rice|juice/i);
  });
});

describe('tokenize and searchTermsFor', () => {
  it('drops filler, accents and plurals', () => {
    expect(tokenize('Grilled Chicken Breasts')).toEqual(['chicken', 'breast']);
    expect(tokenize('Açaí with bananas')).toEqual(['acai', 'banana']);
  });

  it('searches the longest words first, at most three', () => {
    expect(searchTermsFor('smoked salmon fillet with dill')).toEqual([
      'smoked',
      'salmon',
      'fillet',
    ]);
  });
});

describe('pickFoodMatch', () => {
  it('takes the candidate with the fewest extra words that covers the name', () => {
    const pick = pickFoodMatch('chicken breast', [
      food('a', 'Chicken breast'),
      food('b', 'Chicken breast, skinless, boneless'),
      food('c', 'Chicken thigh'),
    ]);
    expect(pick?.id).toBe('a');
  });

  it('returns null when two candidates are equally close', () => {
    expect(pickFoodMatch('rice', [food('a', 'Rice white'), food('b', 'Rice brown')])).toBeNull();
  });

  it('returns null when no candidate carries every word', () => {
    expect(
      pickFoodMatch('salmon steak', [food('a', 'Salmon'), food('b', 'Beef steak')])
    ).toBeNull();
    expect(pickFoodMatch('', [food('a', 'Rice')])).toBeNull();
  });
});

describe('buildPhotoMeal', () => {
  it('uses the matched food id and the unmatched sentinel otherwise, with no numbers', () => {
    const foods = [
      { name: 'rice', grams: 150 },
      { name: 'mystery stew', grams: 200 },
    ];
    const meal = buildPhotoMeal(
      foods,
      new Map([
        ['rice', food('f1', 'Rice, white')],
        ['mystery stew', null],
      ]),
      'lunch'
    );

    expect(meal.meals).toHaveLength(1);
    expect(meal.meals[0].mealType).toBe('lunch');
    expect(meal.meals[0].ingredients).toEqual([
      { name: 'Rice, white', grams: 150, foodId: 'f1', kcal: 0, protein: 0, carbs: 0, fat: 0 },
      {
        name: 'mystery stew',
        grams: 200,
        foodId: LOCAL_PHOTO_UNMATCHED_FOOD_ID,
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
    ]);
  });
});

describe('mealTypeForHour', () => {
  it('maps the clock to the diary meals', () => {
    expect(mealTypeForHour(8)).toBe('breakfast');
    expect(mealTypeForHour(12)).toBe('lunch');
    expect(mealTypeForHour(19)).toBe('dinner');
    expect(mealTypeForHour(23)).toBe('snack');
    expect(mealTypeForHour(3)).toBe('snack');
  });
});

describe('LOCAL_FOOD_IDENTIFY_SCHEMA name bound', () => {
  it('asks for names no longer than the parser keeps', () => {
    expect(LOCAL_FOOD_IDENTIFY_SCHEMA.properties.items.items.properties.name.maxLength).toBe(
      MAX_IDENTIFIED_NAME_CHARS
    );
  });
});

describe('photoMealName', () => {
  it('names the meal after its foods, not the meal type', () => {
    expect(photoMealName(['steak', 'potatoes', 'cheese'])).toBe('Steak, potatoes, cheese');
    expect(photoMealName(['rice', ' rice ', ''])).toBe('Rice');
    expect(photoMealName([])).toBeUndefined();
  });

  it('cuts a long list at a word, within the name limit', () => {
    const name = photoMealName(Array.from({ length: 12 }, (_, i) => `vegetable number ${i}`));

    expect(name!.length).toBeLessThanOrEqual(MAX_IDENTIFIED_NAME_CHARS + 1);
    expect(name!.endsWith('…')).toBe(true);
    expect(name).not.toMatch(/, …$/);
  });

  it('is carried by the review payload', () => {
    const meal = buildPhotoMeal([{ name: 'steak', grams: 250 }], new Map(), 'lunch');

    expect(meal.meals[0]).toMatchObject({ mealType: 'lunch', mealName: 'Steak' });
  });
});

describe('voteIdentifiedFoods', () => {
  it('returns one reading as it is', () => {
    const reading = [{ name: 'rice', grams: 150 }];
    expect(voteIdentifiedFoods([reading])).toBe(reading);
    expect(voteIdentifiedFoods([])).toEqual([]);
  });

  it('keeps foods at least half the readings name, with the median grams', () => {
    expect(
      voteIdentifiedFoods([
        [
          { name: 'Rice', grams: 150 },
          { name: 'stew', grams: 200 },
        ],
        [{ name: 'rice ', grams: 170 }],
        [
          { name: 'RICE', grams: 160 },
          { name: 'cake', grams: 80 },
        ],
      ])
    ).toEqual([{ name: 'Rice', grams: 160 }]);
  });

  it('keeps a food either of two readings names', () => {
    expect(
      voteIdentifiedFoods([[{ name: 'rice', grams: 150 }], [{ name: 'beans', grams: 90 }]])
    ).toEqual([
      { name: 'rice', grams: 150 },
      { name: 'beans', grams: 90 },
    ]);
  });

  it('counts a food named twice in one reading once, with its grams added up', () => {
    expect(
      voteIdentifiedFoods([
        [
          { name: 'rice', grams: 100 },
          { name: 'rice', grams: 50 },
        ],
        [{ name: 'rice', grams: 170 }],
        [{ name: 'bread', grams: 40 }],
      ])
    ).toEqual([{ name: 'rice', grams: 160 }]);
  });
});

describe('mergeFoodsAcrossPhotos', () => {
  it('unions foods in first-seen order, photo 0 first', () => {
    expect(
      mergeFoodsAcrossPhotos([
        [
          { name: 'Rice', grams: 100 },
          { name: 'Egg', grams: 50 },
        ],
        [
          { name: 'Beans', grams: 80 },
          { name: 'Rice', grams: 90 },
        ],
      ])
    ).toEqual([
      { name: 'Rice', grams: 100 },
      { name: 'Egg', grams: 50 },
      { name: 'Beans', grams: 80 },
    ]);
  });

  it('matches by normalized name and keeps the larger grams with its spelling', () => {
    expect(
      mergeFoodsAcrossPhotos([
        [{ name: 'Rice', grams: 100 }],
        [{ name: '  RICE ', grams: 150 }],
        [{ name: 'rice', grams: 120 }],
      ])
    ).toEqual([{ name: '  RICE ', grams: 150 }]);
  });

  it('never sums grams', () => {
    expect(
      mergeFoodsAcrossPhotos([[{ name: 'Egg', grams: 60 }], [{ name: 'Egg', grams: 60 }]])
    ).toEqual([{ name: 'Egg', grams: 60 }]);
  });

  it('ignores empty photos and returns a single list deduped within itself', () => {
    expect(mergeFoodsAcrossPhotos([])).toEqual([]);
    expect(mergeFoodsAcrossPhotos([[], []])).toEqual([]);
    expect(
      mergeFoodsAcrossPhotos([
        [],
        [
          { name: 'Egg', grams: 40 },
          { name: 'Toast', grams: 30 },
          { name: 'egg', grams: 55 },
        ],
      ])
    ).toEqual([
      { name: 'egg', grams: 55 },
      { name: 'Toast', grams: 30 },
    ]);
  });
});
