/**
 * Pure helpers for the coach's shared memories: normalising text, deciding
 * whether a new memory repeats or replaces an existing one, and formatting
 * the list for the system prompt. No React Native or database imports.
 */

export type MemoryVerdict =
  { kind: 'new' } | { kind: 'duplicate'; index: number } | { kind: 'supersedes'; index: number };

export type DatedMemory = { content: string; createdAt: number };

const MIN_WORD_LENGTH = 3;
const MIN_WORDS_FOR_SIMILARITY = 3;
const SUPERSEDE_JACCARD = 0.6;

export function normalizeMemoryText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function memoryWords(text: string): Set<string> {
  const words = new Set<string>();
  for (const word of normalizeMemoryText(text).split(' ')) {
    if (word.length >= MIN_WORD_LENGTH) {
      words.add(word);
    }
  }

  return words;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const word of a) {
    if (b.has(word)) {
      shared += 1;
    }
  }

  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * `existing` is newest first. A candidate is a duplicate when its normalised
 * text is equal to an existing entry; it supersedes the first entry that
 * shares most of its words (both sides need at least three words).
 */
export function classifyMemory(candidate: string, existing: string[]): MemoryVerdict {
  const normalizedCandidate = normalizeMemoryText(candidate);
  const candidateWords = memoryWords(candidate);

  for (let index = 0; index < existing.length; index += 1) {
    if (normalizeMemoryText(existing[index]) === normalizedCandidate) {
      return { kind: 'duplicate', index };
    }
  }

  if (candidateWords.size < MIN_WORDS_FOR_SIMILARITY) {
    return { kind: 'new' };
  }

  for (let index = 0; index < existing.length; index += 1) {
    const words = memoryWords(existing[index]);
    if (words.size < MIN_WORDS_FOR_SIMILARITY) {
      continue;
    }

    if (jaccard(candidateWords, words) >= SUPERSEDE_JACCARD) {
      return { kind: 'supersedes', index };
    }
  }

  return { kind: 'new' };
}

function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatMemoriesForPrompt(memories: DatedMemory[]): string {
  if (memories.length === 0) {
    return '';
  }

  const newestFirst = [...memories].sort((a, b) => b.createdAt - a.createdAt);
  const lines = newestFirst.map(
    (memory) => `- (${localDayKey(memory.createdAt)}) ${memory.content}`
  );

  return [
    'Things you remember about this user (newest first; if two conflict, the newer one is right):',
    ...lines,
  ].join('\n');
}
