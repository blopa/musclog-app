/**
 * Whether what a model put in a free slot was actually said. A small model fills slots from its
 * examples, so a food that appears nowhere in the transcript is not a request, and note words that
 * were never spoken are not the person's note. Pure; no Unicode property escapes (Hermes), so
 * accents are folded through NFD and the combining-mark range.
 */

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const SEPARATORS = /[\s.,;:!?¡¿'"“”‘’()[\]{}/\\\-–—+&*]+/;
const MIN_MATCH_CHARS = 3;
const MIN_LENGTH_SHARE = 2 / 3;
/** How much of a note's wording must have been said for it to stand in for the transcript. */
const MIN_SAID_SHARE = 0.8;

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');
}

function wordsOf(text: string): string[] {
  return fold(text)
    .split(SEPARATORS)
    .filter((word) => word.length > 0);
}

function wordsMatch(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  const [short, long] = a.length <= b.length ? [a, b] : [b, a];

  return (
    short.length >= MIN_MATCH_CHARS &&
    short.length >= long.length * MIN_LENGTH_SHARE &&
    long.includes(short)
  );
}

/** True when the food a model named was said: one of its words matches a word of the transcript. */
export function isFoodSaid(food: string, transcript: string): boolean {
  const foodWords = wordsOf(food);
  if (foodWords.length === 0) {
    return false;
  }

  const spokenWords = wordsOf(transcript);
  // German compounds: "Apfel kuchen" said as "Apfelkuchen".
  if (foodWords.length > 1 && spokenWords.join('').includes(foodWords.join(''))) {
    return true;
  }

  const longWords = foodWords.filter((word) => word.length >= MIN_MATCH_CHARS);
  if (longWords.length === 0) {
    return foodWords.some((word) => spokenWords.includes(word));
  }

  return longWords.some((word) => spokenWords.some((spoken) => wordsMatch(word, spoken)));
}

/** True when nearly every word of `text` was said, so it can stand in for the transcript. */
export function isMostlySaid(text: string, transcript: string): boolean {
  const words = wordsOf(text);
  if (words.length === 0) {
    return false;
  }

  const spokenWords = wordsOf(transcript);
  const said = words.filter((word) => spokenWords.some((spoken) => wordsMatch(word, spoken)));

  return said.length >= words.length * MIN_SAID_SHARE;
}
