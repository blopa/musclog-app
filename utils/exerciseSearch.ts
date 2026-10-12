/**
 * Forgiving exercise search.
 *
 * Every exercise carries a precomputed `search_text` column: its names (in every bundled
 * language), the user's aliases and a few compound-word variants, all run through the SAME
 * normalization and stemming a query goes through. A query is then reduced to terms and each
 * term has to be a substring of that text. Because both sides use this one module, a plural,
 * an accent or a stray hyphen can never make an index and a query disagree.
 *
 * Pure on purpose (no WatermelonDB, no React Native) so it runs in the Jest `node` project and on
 * the website.
 */

/** Combining marks left behind by NFD (é → e + U+0301). Spelled as a range, not `\p{M}`. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Anything that separates words: whitespace, ASCII punctuation (which includes `%` and `_`, the
 * two LIKE wildcards), Latin-1 punctuation and symbols, and the General Punctuation block.
 * Everything else — a letter in ANY script — is kept. This deliberately avoids `\p{L}`: it is
 * not used anywhere else in the app and Hermes support is not worth betting search on.
 */
const WORD_SEPARATORS = /[\s!-/:-@[-`{-~ -¿×÷ -⁯]+/g;

function stripDiacritics(text: string): string {
  try {
    return text.normalize('NFD').replace(COMBINING_MARKS, '');
  } catch {
    // A runtime without String.prototype.normalize still gets consistent (if less forgiving)
    // matching: the index and the query are both built on that same device.
    return text;
  }
}

/**
 * Lowercases, strips diacritics and turns every separator into a single space.
 *
 * The result contains only letters and digits, which is also what makes it safe to embed in a
 * SQL `LIKE` pattern without escaping. (`Q.sanitizeLikeString` is not an option: it rewrites
 * every non-ASCII-alphanumeric character to `_`, so a Cyrillic query would match any string of
 * that length.) Diacritic stripping folds `й → и` and `ё → е` as well, which is what people
 * typing on a phone keyboard usually want.
 */
export function normalizeExerciseText(text: string): string {
  return stripDiacritics(text.toLowerCase()).replace(WORD_SEPARATORS, ' ').trim();
}

/**
 * Reduces a plural to its singular so "flys", "flyes", "flies" and "fly" are one word.
 * Applied to the index and the query alike, so it only has to be consistent, not linguistically
 * perfect — which is why it is also harmless on the other bundled languages.
 */
export function stemToken(token: string): string {
  if (token.length <= 3) {
    return token;
  }
  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (/[^aeiou]yes$/.test(token)) {
    return `${token.slice(0, -3)}y`;
  }
  if (/(ss|sh|ch|x|z)es$/.test(token)) {
    return token.slice(0, -2);
  }
  if (token.endsWith('ss') || token.endsWith('us') || token.endsWith('is')) {
    return token;
  }
  if (token.endsWith('s')) {
    return token.slice(0, -1);
  }
  return token;
}

/** Normalized, stemmed words of a text, in order. */
export function tokenizeExerciseText(text: string): string[] {
  return normalizeExerciseText(text)
    .split(' ')
    .filter((word) => word.length > 0)
    .map(stemToken);
}

/**
 * What an abbreviation can stand for. Each entry is a list of alternatives; an alternative is the
 * words that must ALL appear. The abbreviation itself is always kept as one more alternative, so
 * an exercise (or alias) literally named "RDL" still matches — but only as a WHOLE word. As a
 * substring it would match "hurdle" for `rdl` and every dumbbell exercise for `bb`.
 *
 * Keys are normalized, unstemmed words. Plurals of abbreviations are listed explicitly because the
 * stemmer never sees a key.
 */
export const EXERCISE_ABBREVIATIONS: Readonly<Record<string, readonly (readonly string[])[]>> = {
  db: [['dumbbell']],
  dbs: [['dumbbell']],
  bb: [['barbell']],
  kb: [['kettlebell']],
  kbs: [['kettlebell']],
  bw: [['bodyweight'], ['body', 'weight']],
  dl: [['deadlift']],
  rdl: [['romanian', 'deadlift']],
  rdls: [['romanian', 'deadlift']],
  sldl: [['stiff', 'leg', 'deadlift']],
  ohp: [
    ['overhead', 'press'],
    ['military', 'press'],
    ['shoulder', 'press'],
  ],
  ghr: [['glute', 'ham', 'raise']],
};

/**
 * One query word. A row matches the term when its search text contains ANY alternative, and an
 * alternative matches when ALL of its words are substrings of that text.
 */
export type ExerciseSearchTerm = string[][];

/** A query is the AND of its terms. Empty when the query has no searchable words. */
export function exerciseSearchTerms(query: string): ExerciseSearchTerm[] {
  return normalizeExerciseText(query)
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => {
      const expansions = EXERCISE_ABBREVIATIONS[word];
      if (!expansions) {
        return [[stemToken(word)]];
      }

      // The stored text is padded with spaces (see `buildExerciseSearchText`), so a word wrapped in
      // spaces can only match a whole word.
      const alternatives: ExerciseSearchTerm = [[` ${stemToken(word)} `]];
      for (const expansion of expansions) {
        alternatives.push(expansion.map(stemToken));
      }
      return alternatives;
    });
}

interface SearchTextSource {
  /** Every name the exercise is known by (all bundled languages for a catalogue exercise). */
  names: readonly string[];
  /** User-defined aliases. */
  aliases?: readonly string[];
}

/**
 * The value stored in `exercises.search_text`: a set of unique words, space-separated and padded
 * with a space at each end (so " rdl " can be matched as a whole word with a plain substring test).
 *
 * Word order and adjacency are irrelevant because a query is matched word by word, so the text is
 * a set. Multi-word texts also contribute their words glued together ("push up" → "pushup"), so
 * the compound spelling people type finds them.
 */
export function buildExerciseSearchText({ names, aliases = [] }: SearchTextSource): string {
  const words = new Set<string>();
  for (const text of [...names, ...aliases]) {
    const tokens = tokenizeExerciseText(text);
    for (const token of tokens) {
      words.add(token);
    }
    if (tokens.length > 1) {
      words.add(tokens.join(''));
    }
  }

  return words.size === 0 ? '' : ` ${[...words].join(' ')} `;
}

/** JS twin of the SQL condition, for callers that filter in memory (website, AI name matching). */
export function matchesExerciseSearch(
  searchText: string,
  terms: readonly ExerciseSearchTerm[]
): boolean {
  return terms.every((term) =>
    term.some((alternative) => alternative.every((word) => searchText.includes(word)))
  );
}

interface NamedExercise {
  name: string;
  searchText?: string | null;
}

/**
 * Resolves a free-text exercise name — typically one an LLM parsed out of pasted text — to the
 * exercise it most likely means, or `undefined` when it cannot say.
 *
 * Deliberately conservative, because a wrong answer logs sets against the wrong exercise:
 *  1. a name that is identical after normalization and stemming ("Dumbbell Flys" = "dumbbell fly")
 *     wins outright;
 *  2. otherwise the fuzzy search is accepted ONLY if exactly one exercise matches. "DB Curl" can
 *     mean one thing; "curl" alone means many, and guessing between them is worse than skipping.
 */
export function findExerciseByName<T extends NamedExercise>(
  candidates: readonly T[],
  query: string
): T | undefined {
  const key = tokenizeExerciseText(query).join(' ');
  if (!key) {
    return undefined;
  }

  const exact = candidates.find(
    (candidate) => tokenizeExerciseText(candidate.name).join(' ') === key
  );
  if (exact) {
    return exact;
  }

  const terms = exerciseSearchTerms(query);
  const matches = candidates.filter((candidate) =>
    matchesExerciseSearch(
      candidate.searchText || buildExerciseSearchText({ names: [candidate.name] }),
      terms
    )
  );
  return matches.length === 1 ? matches[0] : undefined;
}
