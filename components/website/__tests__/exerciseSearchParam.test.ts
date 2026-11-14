import {
  exerciseSearchFromQuery,
  exerciseSearchPath,
  MAX_EXERCISE_QUERY_LENGTH,
} from '../exerciseSearchParam';

describe('exerciseSearchFromQuery', () => {
  it('reads q with or without the leading question mark', () => {
    expect(exerciseSearchFromQuery('?q=squat')).toBe('squat');
    expect(exerciseSearchFromQuery('q=squat')).toBe('squat');
  });

  it('decodes plus signs and percent escapes', () => {
    expect(exerciseSearchFromQuery('?q=Barbell+Bench+Press+-+Medium+Grip')).toBe(
      'Barbell Bench Press - Medium Grip'
    );
    expect(exerciseSearchFromQuery('?q=Rom%C3%A2nian')).toBe('Românian');
  });

  it('ignores other parameters and an absent or blank q', () => {
    expect(exerciseSearchFromQuery('')).toBe('');
    expect(exerciseSearchFromQuery('?utm_source=reddit')).toBe('');
    expect(exerciseSearchFromQuery('?q=%20%20')).toBe('');
    expect(exerciseSearchFromQuery('?utm_source=x&q=curl')).toBe('curl');
  });

  it('refuses an oversized value', () => {
    expect(exerciseSearchFromQuery(`?q=${'a'.repeat(MAX_EXERCISE_QUERY_LENGTH + 1)}`)).toBe('');
    expect(exerciseSearchFromQuery(`?q=${'a'.repeat(MAX_EXERCISE_QUERY_LENGTH)}`)).toHaveLength(
      MAX_EXERCISE_QUERY_LENGTH
    );
  });

  it('round-trips through exerciseSearchPath', () => {
    const name = 'Barbell Squat & "Front" Squat/Variation';
    const path = exerciseSearchPath(name);

    expect(path.startsWith('/exercises?')).toBe(true);
    expect(exerciseSearchFromQuery(path.slice(path.indexOf('?')))).toBe(name);
  });
});

describe('program exercise links find their exercise', () => {
  it('every bundled English exercise name, searched through its own link, matches itself', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getExerciseCatalogue } = require('@/data/exerciseCatalogue');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const search = require('@/utils/exerciseSearch');
    const entries = getExerciseCatalogue('en-us') as { name: string }[];

    expect(entries.length).toBeGreaterThan(100);

    for (const entry of entries) {
      const path = exerciseSearchPath(entry.name);
      const query = exerciseSearchFromQuery(path.slice(path.indexOf('?')));
      const terms = search.exerciseSearchTerms(query);
      const text = search.buildExerciseSearchText({ names: [entry.name] });

      expect([entry.name, terms.length > 0 && search.matchesExerciseSearch(text, terms)]).toEqual([
        entry.name,
        true,
      ]);
    }
  });
});
