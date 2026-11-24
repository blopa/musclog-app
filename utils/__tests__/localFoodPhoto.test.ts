import {
  buildPhotoMeal,
  type FoodCandidate,
  LOCAL_FOOD_IDENTIFY_SCHEMA,
  limitFoodCandidates,
  LOCAL_PHOTO_UNMATCHED_FOOD_ID,
  localFoodIdentifyPrompt,
  MAX_FOOD_CANDIDATES,
  MAX_IDENTIFIED_FOODS,
  MAX_IDENTIFIED_NAME_CHARS,
  matchNameOf,
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

const food = (id: string, name: string, description?: string): FoodCandidate => ({
  id,
  name,
  kcal: 100,
  protein: 1,
  carbs: 1,
  fat: 1,
  fiber: 0,
  ...(description ? { description } : {}),
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

describe('limitFoodCandidates', () => {
  const many = (count: number, make: (index: number) => string) =>
    Array.from({ length: count }, (_, index) => food(`f${index}`, make(index)));

  it('returns a list within the limit as it is', () => {
    const list = [food('a', 'Rice white'), food('b', 'Rice brown')];

    expect(limitFoodCandidates('rice', list)).toEqual(list);
    expect(MAX_FOOD_CANDIDATES).toBe(50);
  });

  it('caps a huge result at the limit, the best candidates first', () => {
    // 200 partial matches (a word of the name missing) and the one candidate that carries both.
    const list = [...many(200, (i) => `Rice variety ${i}`), food('best', 'Rice white')];
    const capped = limitFoodCandidates('white rice', list);

    expect(capped).toHaveLength(MAX_FOOD_CANDIDATES);
    expect(capped[0].id).toBe('best');
  });

  it('never changes what pickFoodMatch answers', () => {
    const noise = many(120, (i) => `Rice dish number ${i}`);
    const winner = food('winner', 'Rice, white');
    const list = [...noise, winner];

    expect(pickFoodMatch('white rice', limitFoodCandidates('white rice', list))?.id).toBe(
      pickFoodMatch('white rice', list)?.id
    );
    expect(pickFoodMatch('white rice', limitFoodCandidates('white rice', list))?.id).toBe('winner');
  });

  it('keeps a tie at the top a tie, so a cut never invents a match', () => {
    const list = [
      ...many(80, (i) => `Rice flour ${i}`),
      food('a', 'Rice white'),
      food('b', 'Rice brown'),
    ];

    expect(pickFoodMatch('rice', list)).toBeNull();
    expect(pickFoodMatch('rice', limitFoodCandidates('rice', list))).toBeNull();
  });

  it('takes an explicit limit', () => {
    expect(
      limitFoodCandidates(
        'rice',
        many(10, (i) => `Rice ${i}`),
        3
      )
    ).toHaveLength(3);
  });
});

describe('matchNameOf', () => {
  it('uses the English name when it has one', () => {
    expect(matchNameOf({ name: 'Брокколи', englishName: ' Broccoli ' })).toBe('Broccoli');
  });

  it('falls back to the name when the English name is missing or blank', () => {
    expect(matchNameOf({ name: 'Rice' })).toBe('Rice');
    expect(matchNameOf({ name: 'Rice', englishName: '' })).toBe('Rice');
    expect(matchNameOf({ name: 'Rice', englishName: '   ' })).toBe('Rice');
  });
});

describe('pickFoodMatch with descriptions', () => {
  it('cannot match a name written in a non-Latin script by its own words', () => {
    expect(pickFoodMatch('брокколи', [food('b1', 'Broccoli, raw')])).toBeNull();
    expect(pickFoodMatch('broccoli', [food('b1', 'Broccoli, raw')])?.id).toBe('b1');
  });

  it('matches a candidate on its description when the name does not carry the word', () => {
    const described = food('d1', 'Spring Mix Salad', 'Lettuce, leaf, green, raw');

    expect(pickFoodMatch('lettuce', [described])?.id).toBe('d1');
    expect(pickFoodMatch('lettuce', [food('d1', 'Spring Mix Salad')])).toBeNull();
  });

  it('prefers the description with fewer extra words over a longer name', () => {
    const candidates = [
      food('a', 'Spring Mix a Medley of Baby Lettuces & Greens', 'Lettuce, leaf, green, raw'),
      food('b', 'Mixed Salad Bowl With Lettuce Tomato And Cucumber'),
    ];

    expect(pickFoodMatch('lettuce', candidates)?.id).toBe('a');
  });

  it('stays unmatched when a name and a description tie on extra words', () => {
    const candidates = [food('a', 'Lettuce Salad'), food('b', 'Plain Greens', 'Lettuce Leaf')];

    expect(pickFoodMatch('lettuce', candidates)).toBeNull();
  });

  it('never pools words across the name and the description', () => {
    const candidate = food('c', 'Broccoli', 'Florets, frozen');

    expect(pickFoodMatch('broccoli florets', [candidate])).toBeNull();
  });

  it('scores a candidate without a description exactly as before', () => {
    expect(pickFoodMatch('rice', [food('a', 'Rice white')])?.id).toBe('a');
  });
});

describe('limitFoodCandidates with descriptions', () => {
  it('keeps a description match ahead of worse candidates in a cut', () => {
    const noise = Array.from({ length: 60 }, (_, index) =>
      food(`n${index}`, `Rice variety ${index}`)
    );
    const list = [...noise, food('desc', 'Spring Mix Salad', 'Lettuce, leaf')];
    const capped = limitFoodCandidates('lettuce', list);

    expect(capped).toHaveLength(MAX_FOOD_CANDIDATES);
    expect(capped[0].id).toBe('desc');
    expect(pickFoodMatch('lettuce', capped)?.id).toBe(pickFoodMatch('lettuce', list)?.id);
  });
});

describe('parseIdentifiedFoods englishName', () => {
  it('reads a trimmed, whitespace-collapsed English name', () => {
    expect(
      parseIdentifiedFoods({
        items: [{ name: '  Брокколи  ', grams: 100, englishName: '  Broccoli   raw ' }],
      })
    ).toEqual([{ name: 'Брокколи', grams: 100, englishName: 'Broccoli raw' }]);
  });

  it('caps the English name at the name limit', () => {
    expect(
      parseIdentifiedFoods({ items: [{ name: 'Soup', englishName: 'b'.repeat(200) }] })
    ).toEqual([{ name: 'Soup', grams: 100, englishName: 'b'.repeat(MAX_IDENTIFIED_NAME_CHARS) }]);
  });

  it('leaves the key out when the English name is blank or the same words as the name', () => {
    const [blank] = parseIdentifiedFoods({ items: [{ name: 'Rice', englishName: '   ' }] });
    const [same] = parseIdentifiedFoods({ items: [{ name: 'Rice', englishName: 'RICE' }] });

    expect(blank).not.toHaveProperty('englishName');
    expect(same).not.toHaveProperty('englishName');
  });

  it('keeps the first English name when a repeat names the food again', () => {
    expect(
      parseIdentifiedFoods({
        items: [
          { name: 'Брокколи', grams: 50, englishName: 'Broccoli' },
          { name: 'брокколи', grams: 50, englishName: 'Other' },
        ],
      })
    ).toEqual([{ name: 'Брокколи', grams: 100, englishName: 'Broccoli' }]);
  });

  it('has no englishName key on entries that did not give one', () => {
    const [entry] = parseIdentifiedFoods({ items: [{ name: 'Egg', grams: 50 }] });

    expect(entry).not.toHaveProperty('englishName');
  });
});

describe('LOCAL_FOOD_IDENTIFY_SCHEMA englishName', () => {
  const item = LOCAL_FOOD_IDENTIFY_SCHEMA.properties.items.items;

  it('bounds englishName and leaves it optional', () => {
    expect(item.properties.englishName.maxLength).toBe(MAX_IDENTIFIED_NAME_CHARS);
    expect(item.required).toEqual(['name', 'grams']);
  });

  it('validates answers with and without an English name', () => {
    expect(
      validateAgainstSchema(
        { items: [{ name: 'брокколи', grams: 100, englishName: 'broccoli' }] },
        LOCAL_FOOD_IDENTIFY_SCHEMA
      ).ok
    ).toBe(true);
    expect(
      validateAgainstSchema({ items: [{ name: 'rice', grams: 100 }] }, LOCAL_FOOD_IDENTIFY_SCHEMA)
        .ok
    ).toBe(true);
  });

  it('is mentioned by the prompt', () => {
    expect(localFoodIdentifyPrompt()).toMatch(/englishName/);
  });
});

describe('voteIdentifiedFoods englishName', () => {
  it('keeps the first non-empty English name seen across readings', () => {
    expect(
      voteIdentifiedFoods([
        [{ name: 'Брокколи', grams: 100 }],
        [{ name: 'брокколи', grams: 120, englishName: 'Broccoli' }],
        [{ name: 'Брокколи', grams: 110 }],
      ])
    ).toEqual([{ name: 'Брокколи', grams: 110, englishName: 'Broccoli' }]);
  });

  it('has no englishName key when no reading gave one', () => {
    const [entry] = voteIdentifiedFoods([
      [{ name: 'Rice', grams: 100 }],
      [{ name: 'rice', grams: 200 }],
    ]);

    expect(entry).toEqual({ name: 'Rice', grams: 150 });
    expect(entry).not.toHaveProperty('englishName');
  });

  it('keeps the first English name when readings disagree', () => {
    expect(
      voteIdentifiedFoods([
        [{ name: 'Pão', grams: 60, englishName: 'Bread' }],
        [{ name: 'Pão', grams: 60, englishName: 'Loaf' }],
      ])
    ).toEqual([{ name: 'Pão', grams: 60, englishName: 'Bread' }]);
  });
});

describe('mergeFoodsAcrossPhotos englishName', () => {
  it('carries an English name over to the larger entry that lacks one', () => {
    expect(
      mergeFoodsAcrossPhotos([
        [{ name: 'Брокколи', grams: 50, englishName: 'Broccoli' }],
        [{ name: 'брокколи', grams: 120 }],
      ])
    ).toEqual([{ name: 'брокколи', grams: 120, englishName: 'Broccoli' }]);
  });

  it('lets the larger entry keep its own English name', () => {
    expect(
      mergeFoodsAcrossPhotos([
        [{ name: 'Egg', grams: 50, englishName: 'Ovo' }],
        [{ name: 'egg', grams: 90, englishName: 'Egg' }],
      ])
    ).toEqual([{ name: 'egg', grams: 90, englishName: 'Egg' }]);
  });

  it('keeps the larger entry own English name over a smaller one', () => {
    expect(
      mergeFoodsAcrossPhotos([
        [{ name: 'Брокколи', grams: 120, englishName: 'Broccoli' }],
        [{ name: 'брокколи', grams: 50, englishName: 'Florets' }],
      ])
    ).toEqual([{ name: 'Брокколи', grams: 120, englishName: 'Broccoli' }]);
  });
});
