import {
  buildExerciseSearchText,
  EXERCISE_ABBREVIATIONS,
  exerciseSearchTerms,
  findExerciseByName,
  matchesExerciseSearch,
  normalizeExerciseText,
  stemToken,
  tokenizeExerciseText,
} from '../exerciseSearch';

function search(names: string[], query: string, aliases: string[] = []): boolean {
  return matchesExerciseSearch(
    buildExerciseSearchText({ names, aliases }),
    exerciseSearchTerms(query)
  );
}

describe('normalizeExerciseText', () => {
  it('lowercases, strips accents and collapses separators', () => {
    expect(normalizeExerciseText('  Supino   Inclinado—Haltères!  ')).toBe(
      'supino inclinado haltères'.normalize('NFD').replace(/[̀-ͯ]/g, '')
    );
    expect(normalizeExerciseText('Sentadilla búlgara')).toBe('sentadilla bulgara');
    expect(normalizeExerciseText('Push-Ups (Wide)')).toBe('push ups wide');
  });

  it('keeps non-Latin letters and folds Cyrillic case', () => {
    expect(normalizeExerciseText('Жим Лёжа')).toBe('жим лежа');
    expect(normalizeExerciseText('ЖИМ')).toBe('жим');
  });

  it('turns the LIKE wildcards into separators so a query can never inject one', () => {
    expect(normalizeExerciseText('100%_curl')).toBe('100 curl');
    expect(normalizeExerciseText('%')).toBe('');
    expect(normalizeExerciseText('_')).toBe('');
  });
});

describe('stemToken', () => {
  it.each([
    ['flys', 'fly'],
    ['flyes', 'fly'],
    ['flies', 'fly'],
    ['fly', 'fly'],
    ['presses', 'press'],
    ['press', 'press'],
    ['crunches', 'crunch'],
    ['curls', 'curl'],
    ['lunges', 'lunge'],
    ['deadlifts', 'deadlift'],
    ['triceps', 'tricep'],
    ['gluteus', 'gluteus'],
    ['abs', 'abs'],
  ])('%s → %s', (input, expected) => {
    expect(stemToken(input)).toBe(expected);
  });
});

describe('exerciseSearchTerms', () => {
  it('returns nothing for a query with no searchable words', () => {
    expect(exerciseSearchTerms('')).toEqual([]);
    expect(exerciseSearchTerms('  %_ ')).toEqual([]);
  });

  it('keeps the abbreviation as an alternative next to its expansions', () => {
    expect(exerciseSearchTerms('rdl')).toEqual([[[' rdl '], ['romanian', 'deadlift']]]);
  });

  it('stems every word of a multi-word query', () => {
    expect(exerciseSearchTerms('lat pulldowns')).toEqual([[['lat']], [['pulldown']]]);
  });

  it('only lists abbreviations whose expansions are already normalized', () => {
    for (const expansions of Object.values(EXERCISE_ABBREVIATIONS)) {
      for (const alternative of expansions) {
        expect(alternative.join(' ')).toBe(normalizeExerciseText(alternative.join(' ')));
      }
    }
  });
});

describe('buildExerciseSearchText', () => {
  it('is a set of unique stemmed words plus the glued spelling', () => {
    expect(
      buildExerciseSearchText({ names: ['Push-Ups', 'Push ups'] })
        .trim()
        .split(' ')
        .sort()
    ).toEqual(['pushups', 'push', 'ups'].sort());
  });

  it('pads the word set so an abbreviation can be matched as a whole word', () => {
    expect(buildExerciseSearchText({ names: ['Hurdle Hops'] })).toBe(' hurdle hop hurdlehop ');
    expect(buildExerciseSearchText({ names: [] })).toBe('');
  });

  it('includes aliases', () => {
    expect(
      buildExerciseSearchText({ names: ['Bench Press'], aliases: ['Chest Day Special'] })
    ).toContain('special');
  });
});

describe('searching', () => {
  const dumbbellFly = ['Dumbbell Flyes'];

  it.each(['fly', 'flys', 'flyes', 'flies', 'dumbbell flyes', 'flyes dumbbell', 'DUMBBELL FLY'])(
    'finds Dumbbell Flyes with "%s"',
    (query) => {
      expect(search(dumbbellFly, query)).toBe(true);
    }
  );

  it('expands DB to dumbbell', () => {
    expect(search(dumbbellFly, 'db flys')).toBe(true);
    expect(search(['Barbell Curl'], 'db curl')).toBe(false);
  });

  it('expands RDL to Romanian deadlift', () => {
    expect(search(['Romanian Deadlift'], 'rdl')).toBe(true);
    expect(search(['Stiff-Legged Deadlift'], 'rdl')).toBe(false);
  });

  it('expands OHP to any of its common names', () => {
    expect(search(['Standing Military Press'], 'ohp')).toBe(true);
    expect(search(['Barbell Shoulder Press'], 'ohp')).toBe(true);
    expect(search(['Barbell Curl'], 'ohp')).toBe(false);
  });

  it('matches an exercise literally named after the abbreviation', () => {
    expect(search(['RDL (Hip Hinge)'], 'rdl')).toBe(true);
  });

  it('matches the abbreviation itself only as a whole word, never inside another word', () => {
    expect(search(['Hurdle Hops'], 'rdl')).toBe(false);
    // "bb" sits inside "dumbbell"; it must mean barbell, not "any dumbbell exercise".
    expect(search(['Dumbbell Curl'], 'bb curl')).toBe(false);
    expect(search(['Barbell Curl'], 'bb curl')).toBe(true);
    expect(search(['Romanian Deadlift'], 'dl')).toBe(true);
    expect(search(['Handle Pull'], 'dl')).toBe(false);
  });

  it('is accent-insensitive in both directions', () => {
    expect(search(['Sentadilla búlgara'], 'bulgara')).toBe(true);
    expect(search(['Sentadilla bulgara'], 'búlgara')).toBe(true);
  });

  it('is case-insensitive for Cyrillic, which SQLite LIKE is not', () => {
    expect(search(['Жим лёжа'], 'ЖИМ')).toBe(true);
    expect(search(['Жим лёжа'], 'лежа')).toBe(true);
  });

  it('matches names from another language stored alongside', () => {
    expect(search(['Sentadilla', 'Squat', 'Agachamento'], 'squat')).toBe(true);
    expect(search(['Sentadilla', 'Squat', 'Agachamento'], 'agachamento')).toBe(true);
  });

  it('matches compound spellings', () => {
    expect(search(['Pull-Ups'], 'pullups')).toBe(true);
    expect(search(['Pullups'], 'pull up')).toBe(true);
    expect(search(['Push-Up'], 'pushup')).toBe(true);
  });

  it('matches the user aliases of an exercise', () => {
    expect(search(['Barbell Bench Press - Medium Grip'], 'bp')).toBe(false);
    expect(search(['Barbell Bench Press - Medium Grip'], 'bp', ['BP'])).toBe(true);
  });

  it('requires every word of the query', () => {
    expect(search(['Barbell Curl'], 'barbell squat')).toBe(false);
  });

  it('treats % and _ as separators, not wildcards', () => {
    expect(search(['Barbell Curl'], '%')).toBe(true); // no searchable words → no filter
    expect(search(['Barbell Curl'], 'barbell%')).toBe(true);
    expect(search(['Barbell Curl'], 'xyz_curl')).toBe(false);
    // Whatever the user types, no wildcard can reach the LIKE pattern built from these terms.
    expect(JSON.stringify(exerciseSearchTerms('b_rb%ll 100%'))).not.toMatch(/[%_]/);
  });

  it('tokenizes consistently on both sides', () => {
    expect(tokenizeExerciseText('Dumbbell Flyes')).toEqual(['dumbbell', 'fly']);
    expect(tokenizeExerciseText('dumbbell flys')).toEqual(['dumbbell', 'fly']);
  });
});

describe('findExerciseByName', () => {
  const library = [
    { id: 'fly', name: 'Dumbbell Flyes' },
    { id: 'rdl', name: 'Romanian Deadlift' },
    { id: 'db-curl', name: 'Dumbbell Curl' },
    { id: 'bb-curl', name: 'Barbell Curl' },
    { id: 'pullup', name: 'Pull-Ups' },
  ];
  const idOf = (query: string, candidates = library) => findExerciseByName(candidates, query)?.id;

  it('resolves names that are identical once normalized', () => {
    expect(idOf('dumbbell flys')).toBe('fly');
    expect(idOf('ROMANIAN  DEADLIFT')).toBe('rdl');
    expect(idOf('Pull Ups')).toBe('pullup');
  });

  it('resolves an abbreviation that leaves exactly one candidate', () => {
    expect(idOf('DB Curl')).toBe('db-curl');
    expect(idOf('rdl')).toBe('rdl');
  });

  it('never guesses between several plausible exercises', () => {
    expect(idOf('curl')).toBeUndefined();
  });

  it('returns nothing for text it cannot place, or for nothing at all', () => {
    expect(idOf('Bulgarian Split Squat')).toBeUndefined();
    expect(idOf('')).toBeUndefined();
    expect(idOf('%%')).toBeUndefined();
  });

  it('uses a stored search text, so aliases and other languages resolve', () => {
    const withAlias = [
      {
        id: 'bench',
        name: 'Barbell Bench Press',
        searchText: buildExerciseSearchText({
          names: ['Barbell Bench Press', 'Supino Reto'],
          aliases: ['BP'],
        }),
      },
      { id: 'squat', name: 'Squat', searchText: 'squat' },
    ];
    expect(idOf('supino reto', withAlias)).toBe('bench');
    expect(idOf('bp', withAlias)).toBe('bench');
  });

  it('prefers an exact match over a fuzzier one that also fits', () => {
    expect(
      idOf('Curl', [
        { id: 'curl', name: 'Curl' },
        { id: 'db-curl', name: 'Dumbbell Curl' },
      ])
    ).toBe('curl');
  });
});
