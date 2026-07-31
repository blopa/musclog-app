import { MECHANIC_TYPES, normalizeMechanicType } from '../mechanicType';

describe('normalizeMechanicType', () => {
  it('passes canonical types through unchanged', () => {
    for (const type of MECHANIC_TYPES) {
      expect(normalizeMechanicType(type)).toBe(type);
    }
  });

  it.each([
    ['COMPOUND', 'compound'],
    ['Compound', 'compound'],
    ['  isolation  ', 'isolation'],
    ['\tCaRdIo\n', 'cardio'],
  ])('normalizes casing and surrounding whitespace: %p -> %p', (input, expected) => {
    expect(normalizeMechanicType(input)).toBe(expected);
  });

  // Every one of these must land on the same bucket the training set uses,
  // otherwise a segment's mechanic_* one-hot and its model would disagree.
  it.each([[undefined], [null], [''], ['   '], ['powerlifting'], ['compound-ish']])(
    'collapses missing or unrecognised values to unknown: %p',
    (input) => {
      expect(normalizeMechanicType(input)).toBe('unknown');
    }
  );

  it('keeps the list in the order the feature vector depends on', () => {
    // MECHANIC_TYPES order fixes the mechanic_* column positions in the
    // 42-feature vector, and must match `sorted(MECHANIC_TYPES)` in train.py.
    expect([...MECHANIC_TYPES]).toEqual([...MECHANIC_TYPES].sort());
  });
});
