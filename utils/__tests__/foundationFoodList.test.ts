import {
  buildFoundationFoodList,
  FOUNDATION_FOODS_PROMPT_CAP,
  foundationFoodIdFor,
  resolveFoundationRefs,
  resolveFoundationRefsInMeals,
} from '@/utils/foundationFoodList';

const UUID = '3f2b8c1e-9d4a-4e6b-8f7a-1234567890ab';

const foods = [
  { id: 'id-Rice', name: 'Rice' },
  { id: 'id-Broccoli', name: 'Broccoli, raw' },
  { id: 'id-Apple', name: 'Apple' },
  { id: 'id-Oats', name: 'Oats' },
  { id: 'id-Egg', name: 'Egg' },
];

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = (i * 7 + 3) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

describe('buildFoundationFoodList', () => {
  it('returns null for no foods, or foods with an empty name or id', () => {
    expect(buildFoundationFoodList([])).toBeNull();
    expect(buildFoundationFoodList([{ id: 'x', name: '' }])).toBeNull();
    expect(buildFoundationFoodList([{ id: '', name: 'Rice' }])).toBeNull();
  });

  it('lists every food as reference|name with references 1..N in sorted order', () => {
    const list = buildFoundationFoodList(foods);

    expect(list?.listing.split('\n')).toEqual([
      '1|Apple',
      '2|Broccoli, raw',
      '3|Egg',
      '4|Oats',
      '5|Rice',
    ]);
  });

  it('sorts by name then id, identically whatever the input order', () => {
    const a = buildFoundationFoodList(foods);
    const b = buildFoundationFoodList(shuffled(foods));

    expect(b?.listing).toBe(a?.listing);
  });

  it('gives the same listing on every call', () => {
    expect(buildFoundationFoodList(foods)?.listing).toBe(buildFoundationFoodList(foods)?.listing);
  });

  it('collapses newlines and runs of spaces in a name to one trimmed line', () => {
    const list = buildFoundationFoodList([{ id: 'id-a', name: '  Milk,\n\n  whole   \t fat ' }]);

    expect(list?.listing).toBe('1|Milk, whole fat');
    expect(list?.count).toBe(1);
  });

  it('caps the list at the given size, keeping the first sorted foods', () => {
    const list = buildFoundationFoodList(foods, 3);

    expect(list?.count).toBe(3);
    expect(list?.listing.split('\n')).toEqual(['1|Apple', '2|Broccoli, raw', '3|Egg']);
  });

  it('caps by default at FOUNDATION_FOODS_PROMPT_CAP', () => {
    expect(FOUNDATION_FOODS_PROMPT_CAP).toBe(1000);

    const many = Array.from({ length: 1200 }, (_, i) => ({
      id: `id-${i}`,
      name: `Food ${String(i).padStart(4, '0')}`,
    }));

    expect(buildFoundationFoodList(many)?.count).toBe(1000);
  });

  it('maps every reference back to the id of the food named on its line', () => {
    const list = buildFoundationFoodList(foods);
    if (!list) {
      throw new Error('expected a list');
    }

    for (const line of list.listing.split('\n')) {
      const separator = line.indexOf('|');
      const reference = line.slice(0, separator);
      const name = line.slice(separator + 1);
      const food = foods.find((f) => f.name === name);

      expect(list.idByRef.get(reference)).toBe(food?.id);
    }
  });

  it('never puts a UUID or macro in the listing', () => {
    const list = buildFoundationFoodList([{ id: UUID, name: 'Rice, cooked' }]);

    expect(list?.listing).toBe('1|Rice, cooked');
    expect(list?.listing).not.toContain(UUID);
  });

  it('has exactly count lines', () => {
    const list = buildFoundationFoodList(foods);

    expect(list?.listing.split('\n')).toHaveLength(list?.count ?? -1);
  });
});

describe('foundationFoodIdFor', () => {
  const list = buildFoundationFoodList(foods);
  const refs = list ? { idByRef: list.idByRef } : null;

  it('resolves a valid reference to its food id', () => {
    expect(foundationFoodIdFor('1', refs)).toBe('id-Apple');
  });

  it('tolerates whitespace, leading zeros and a plain number', () => {
    expect(foundationFoodIdFor(' 2 ', refs)).toBe('id-Broccoli');
    expect(foundationFoodIdFor('002', refs)).toBe('id-Broccoli');
    expect(foundationFoodIdFor(2, refs)).toBe('id-Broccoli');
  });

  it('returns null for a reference past the list', () => {
    expect(foundationFoodIdFor('9999', refs)).toBeNull();
  });

  it('returns null for malformed references', () => {
    for (const bad of ['abc', '2|Broccoli', '#2', '', null, undefined, {}]) {
      expect(foundationFoodIdFor(bad, refs)).toBeNull();
    }
  });

  it('returns null when there is no list', () => {
    expect(foundationFoodIdFor('1', null)).toBeNull();
    expect(foundationFoodIdFor(null, null)).toBeNull();
  });
});

describe('resolveFoundationRefs', () => {
  const list = buildFoundationFoodList(foods);
  const refs = list ? { idByRef: list.idByRef } : null;

  it('replaces a valid foodId reference with the real id and keeps other fields', () => {
    const input = [{ name: 'Rice', grams: 100, foodId: '5' }];

    expect(resolveFoundationRefs(input, refs)).toEqual([
      { name: 'Rice', grams: 100, foodId: 'id-Rice' },
    ]);
  });

  it('drops the foodId key for an unknown, malformed, null or undefined reference', () => {
    const input = [
      { name: 'A', foodId: '9999' },
      { name: 'B', foodId: 'junk' },
      { name: 'C', foodId: null },
      { name: 'D', foodId: undefined },
    ];

    const result = resolveFoundationRefs(input, refs);

    for (const ingredient of result) {
      expect('foodId' in ingredient).toBe(false);
    }
    expect(result.map((i) => i.name)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('returns an ingredient with no foodId key as it is', () => {
    const ingredient = { name: 'Water', grams: 250 };

    const [result] = resolveFoundationRefs([ingredient], refs);

    expect(result).toBe(ingredient);
  });

  it('returns the ingredients unchanged when there is no list', () => {
    const input = [{ name: 'Rice', foodId: '5' }];

    const result = resolveFoundationRefs(input, null);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('does not mutate the input array or objects', () => {
    const input = [
      { name: 'Rice', foodId: '5' },
      { name: 'X', foodId: '9999' },
    ];
    const snapshot = JSON.parse(JSON.stringify(input));

    resolveFoundationRefs(input, refs);

    expect(input).toEqual(snapshot);
  });
});

describe('resolveFoundationRefsInMeals', () => {
  const list = buildFoundationFoodList(foods);
  const refs = list ? { idByRef: list.idByRef } : null;

  it('resolves the ingredients of every meal', () => {
    const response = {
      meals: [
        { name: 'Breakfast', ingredients: [{ name: 'Oats', foodId: '4' }] },
        { name: 'Lunch', ingredients: [{ name: 'Egg', foodId: '3' }] },
      ],
    };

    const result = resolveFoundationRefsInMeals(response, refs);

    expect(result.meals[0].ingredients).toEqual([{ name: 'Oats', foodId: 'id-Oats' }]);
    expect(result.meals[1].ingredients).toEqual([{ name: 'Egg', foodId: 'id-Egg' }]);
  });

  it('leaves a meal with no ingredients array and a null meal alone', () => {
    const noIngredients = { name: 'Snack' };
    const response = { meals: [noIngredients, null] };

    const result = resolveFoundationRefsInMeals(response, refs);

    expect(result.meals[0]).toBe(noIngredients);
    expect(result.meals[1]).toBeNull();
  });

  it('returns the same response object when there is no list', () => {
    const response = { meals: [{ ingredients: [{ foodId: '1' }] }] };

    expect(resolveFoundationRefsInMeals(response, null)).toBe(response);
  });

  it('preserves other response fields', () => {
    const response = {
      description: 'A recipe',
      meals: [{ ingredients: [{ name: 'Rice', foodId: '5' }] }],
    };

    const result = resolveFoundationRefsInMeals(response, refs);

    expect(result.description).toBe('A recipe');
  });
});
