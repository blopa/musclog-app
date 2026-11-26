import { combineExtractions } from '../extractionConsensus';

describe('combineExtractions', () => {
  it('returns a single reading as it is', () => {
    const reading = { calories: 250, name: 'Oat bar' };
    expect(combineExtractions([reading])).toEqual({ value: reading, disputed: [] });
  });

  it('answers nothing for no readings', () => {
    expect(combineExtractions([])).toEqual({ value: null, disputed: [] });
  });

  it('takes the median of numbers that agree within tolerance', () => {
    const result = combineExtractions([{ protein: 20.0 }, { protein: 20.6 }, { protein: 20.3 }]);
    expect(result).toEqual({ value: { protein: 20.3 }, disputed: [] });
  });

  it('accepts half a unit on small values and 5% on large ones', () => {
    expect(combineExtractions([{ fat: 1 }, { fat: 1.5 }]).disputed).toEqual([]);
    expect(combineExtractions([{ kcal: 400 }, { kcal: 419 }]).disputed).toEqual([]);
    expect(combineExtractions([{ kcal: 400 }, { kcal: 430 }]).disputed).toEqual(['kcal']);
  });

  it('disputes any disagreement between two readings, and rounds whole numbers', () => {
    expect(combineExtractions([{ reps: 8 }, { reps: 11 }])).toEqual({
      value: { reps: 10 },
      disputed: ['reps'],
    });
  });

  it('with three readings, disputes only a field no two of them agree on', () => {
    expect(combineExtractions([{ reps: 8 }, { reps: 12 }, { reps: 8 }])).toEqual({
      value: { reps: 8 },
      disputed: [],
    });
    expect(combineExtractions([{ reps: 6 }, { reps: 9 }, { reps: 12 }]).disputed).toEqual(['reps']);
  });

  it('votes on text ignoring case and spacing, keeping the first spelling', () => {
    expect(
      combineExtractions([{ name: ' Bench Press' }, { name: 'bench press' }, { name: 'Squat' }])
    ).toEqual({ value: { name: ' Bench Press' }, disputed: [] });
    expect(combineExtractions([{ name: 'Bench' }, { name: 'Squat' }])).toEqual({
      value: { name: 'Bench' },
      disputed: ['name'],
    });
  });

  it('combines lists of the same length item by item, with paths', () => {
    const result = combineExtractions([
      { pastWorkouts: [{ sets: [{ reps: 5 }, { reps: 5 }] }] },
      { pastWorkouts: [{ sets: [{ reps: 5 }, { reps: 8 }] }] },
    ]);
    expect(result.disputed).toEqual(['pastWorkouts[0].sets[1].reps']);
  });

  it('keeps the length most readings share and disputes the list', () => {
    const result = combineExtractions([
      { items: ['a', 'b'] },
      { items: ['a', 'b', 'c'] },
      { items: ['a', 'b'] },
    ]);
    expect(result).toEqual({ value: { items: ['a', 'b'] }, disputed: ['items'] });
  });

  it('takes the first reading length on a tie', () => {
    const result = combineExtractions([{ items: [1, 2, 3] }, { items: [1, 2] }]);
    expect(result.value).toEqual({ items: [1, 2, 3] });
    expect(result.disputed).toContain('items');
  });

  it('keeps a key most readings have, and disputes one some left out', () => {
    expect(combineExtractions([{ a: 1, fiber: 3 }, { a: 1, fiber: 3 }, { a: 1 }])).toEqual({
      value: { a: 1, fiber: 3 },
      disputed: ['fiber'],
    });
    expect(combineExtractions([{ a: 1, fiber: 3 }, { a: 1 }, { a: 1 }])).toEqual({
      value: { a: 1 },
      disputed: ['fiber'],
    });
  });

  it('votes on booleans and mixed kinds', () => {
    expect(combineExtractions([{ ok: true }, { ok: false }, { ok: true }]).value).toEqual({
      ok: true,
    });
    expect(combineExtractions([{ v: null }, { v: 3 }]).disputed).toEqual(['v']);
  });
});

describe('combineExtractions, items with an identity', () => {
  const day1 = { date: '2026-01-01', calories: 400 };
  const day2 = { date: '2026-01-02', calories: 600 };

  it('matches entries by identity when readings list them in a different order', () => {
    const result = combineExtractions([
      { pastNutrition: [day1, day2] },
      { pastNutrition: [day2, day1] },
    ]);
    expect(result).toEqual({ value: { pastNutrition: [day1, day2] }, disputed: [] });
  });

  it('with two readings, drops an entry one reading lacks and disputes the list', () => {
    const result = combineExtractions([{ pastNutrition: [day1, day2] }, { pastNutrition: [day1] }]);
    expect(result).toEqual({
      value: { pastNutrition: [day1] },
      disputed: ['pastNutrition'],
    });
  });

  it('with three readings, keeps an entry that two of them found', () => {
    const result = combineExtractions([
      { pastNutrition: [day1, day2] },
      { pastNutrition: [day1, day2] },
      { pastNutrition: [day1] },
    ]);
    expect(result.value).toEqual({ pastNutrition: [day1, day2] });
    expect(result.disputed).toEqual(['pastNutrition']);
  });

  it('falls back to position when one reading repeats an identity', () => {
    const result = combineExtractions([
      {
        pastNutrition: [
          { date: 'd', calories: 400 },
          { date: 'd', calories: 600 },
        ],
      },
      {
        pastNutrition: [
          { date: 'd', calories: 410 },
          { date: 'd', calories: 610 },
        ],
      },
    ]);
    expect(result).toEqual({
      value: {
        pastNutrition: [
          { date: 'd', calories: 405 },
          { date: 'd', calories: 605 },
        ],
      },
      disputed: [],
    });
  });

  it('keeps sets combining by position, since they carry no identity', () => {
    const result = combineExtractions([
      {
        sets: [
          { reps: 5, weight: 100 },
          { reps: 8, weight: 90 },
        ],
      },
      {
        sets: [
          { reps: 8, weight: 90 },
          { reps: 5, weight: 100 },
        ],
      },
    ]);
    expect(result.value).toEqual({
      sets: [
        { reps: 7, weight: 95 },
        { reps: 7, weight: 95 },
      ],
    });
    expect(result.disputed).toContain('sets[0].reps');
  });
});

describe('combineExtractions with an arbiter', () => {
  it('aligns an identity list by identity, whatever order the arbiter lists it in', () => {
    const result = combineExtractions(
      [
        {
          pastWorkouts: [
            { title: 'Push', reps: 10 },
            { title: 'Pull', reps: 8 },
          ],
        },
        {
          pastWorkouts: [
            { title: 'Pull', reps: 8 },
            { title: 'Push', reps: 12 },
          ],
        },
      ],
      {
        arbiter: {
          pastWorkouts: [
            { title: 'Pull', reps: 8 },
            { title: 'Push', reps: 12 },
          ],
        },
      }
    );

    expect(result.value).toEqual({
      pastWorkouts: [
        { title: 'Push', reps: 12 },
        { title: 'Pull', reps: 8 },
      ],
    });
    expect(result.disputed).toEqual(['pastWorkouts[0].reps']);
  });

  it('takes the arbiter only at the disputed paths', () => {
    const result = combineExtractions(
      [
        { name: 'Oat bar', protein: 10, items: [{ reps: 8, weight: 50 }] },
        { name: 'Oat bar', protein: 14, items: [{ reps: 10, weight: 50 }] },
      ],
      { arbiter: { name: 'Other', protein: 12, items: [{ reps: 9, weight: 60 }] } }
    );

    expect(result.value).toEqual({
      name: 'Oat bar',
      protein: 12,
      items: [{ reps: 9, weight: 50 }],
    });
    expect(result.disputed).toEqual(['protein', 'items[0].reps']);
  });

  it('adds a disputed key the combined answer left out, and a whole disputed list', () => {
    const result = combineExtractions([{ a: 1, b: 3, list: [1] }, { a: 1, list: [1] }, { a: 1 }], {
      arbiter: { a: 2, b: 3, list: [1, 2] },
    });

    expect(result.value).toEqual({ a: 1, b: 3, list: [1, 2] });
  });

  it('keeps the combined value where the arbiter has nothing', () => {
    const result = combineExtractions(
      [
        { a: 1, b: 2 },
        { a: 5, b: 10 },
      ],
      { arbiter: { a: 7 } }
    );

    expect(result.value).toEqual({ a: 7, b: 6 });
  });

  it('uses the arbiter outright when the root itself is disputed', () => {
    expect(combineExtractions(['x', 'y'], { arbiter: 'z' }).value).toBe('z');
    expect(combineExtractions(['x', 'y'], { arbiter: null }).value).toBe('x');
  });

  it('settles a disputed list with the arbiter list, and combines positional lists by index', () => {
    expect(
      combineExtractions([{ items: [1, 2, 3] }, { items: [1, 2] }], {
        arbiter: { items: [1, 2, 4] },
      }).value
    ).toEqual({ items: [1, 2, 4] });
    expect(
      combineExtractions(
        [{ sets: [{ reps: 5 }, { reps: 5 }] }, { sets: [{ reps: 5 }, { reps: 9 }] }],
        {
          arbiter: { sets: [{ reps: 1 }, { reps: 8 }] },
        }
      ).value
    ).toEqual({ sets: [{ reps: 5 }, { reps: 8 }] });
  });

  it('leaves an entry the arbiter does not list as combined', () => {
    const result = combineExtractions(
      [
        {
          w: [
            { title: 'Push', reps: 10 },
            { title: 'Pull', reps: 8 },
          ],
        },
        {
          w: [
            { title: 'Push', reps: 12 },
            { title: 'Pull', reps: 12 },
          ],
        },
      ],
      { arbiter: { w: [{ title: 'Pull', reps: 9 }] } }
    );

    expect(result.value).toEqual({
      w: [
        { title: 'Push', reps: 11 },
        { title: 'Pull', reps: 9 },
      ],
    });
  });

  it('gives no answer below an identity list when the arbiter list has no identities', () => {
    const result = combineExtractions(
      [{ w: [{ title: 'Push', reps: 10 }] }, { w: [{ title: 'Push', reps: 12 }] }],
      { arbiter: { w: [{ reps: 99 }] } }
    );

    expect(result.value).toEqual({ w: [{ title: 'Push', reps: 11 }] });
  });

  it('returns the same value and disputed paths with no arbiter', () => {
    const readings = [
      { reps: 8, w: [{ title: 'A', n: 1 }] },
      { reps: 11, w: [{ title: 'A', n: 1 }] },
    ];

    expect(combineExtractions(readings)).toEqual({
      value: { reps: 10, w: [{ title: 'A', n: 1 }] },
      disputed: ['reps'],
    });
    expect(combineExtractions(readings, {})).toEqual(combineExtractions(readings));
  });
});
