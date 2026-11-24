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
