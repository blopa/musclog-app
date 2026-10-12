import { Q } from '@nozbe/watermelondb';
import type { Where } from '@nozbe/watermelondb/QueryDescription';

import { exerciseSearchTerms, normalizeExerciseText } from '@/utils/exerciseSearch';

// Every word handed to `Q.like` below is already reduced to letters and digits by
// `normalizeExerciseText`, so it contains no `%` or `_` and needs no escaping. Do NOT swap in
// `Q.sanitizeLikeString`: it turns every non-ASCII-alphanumeric character into `_`, which would
// make a Cyrillic query match any string of the same length.
const containsWord = (word: string) => Q.where('search_text', Q.like(`%${word}%`));

/**
 * The `exercises` condition for a search box, or `null` when the text has no searchable words.
 *
 * A row matches when every query word is found in its precomputed `search_text`; an abbreviation
 * word matches any of its expansions (see `EXERCISE_ABBREVIATIONS`). Rows the boot backfill has not
 * reached yet have no `search_text`, so they are matched by `name` instead — a plain substring
 * match, exactly what search did before this column existed.
 */
export function exerciseSearchCondition(searchTerm: string): Where | null {
  const terms = exerciseSearchTerms(searchTerm);
  if (terms.length === 0) {
    return null;
  }

  const indexedMatch = Q.and(
    ...terms.map((term) => {
      const alternatives = term.map((alternative) =>
        alternative.length === 1
          ? containsWord(alternative[0])
          : Q.and(...alternative.map(containsWord))
      );
      return alternatives.length === 1 ? alternatives[0] : Q.or(...alternatives);
    })
  );

  const unindexedMatch = Q.and(
    Q.where('search_text', Q.eq(null)),
    Q.where('name', Q.like(`%${normalizeExerciseText(searchTerm)}%`))
  );

  return Q.or(indexedMatch, unindexedMatch);
}
