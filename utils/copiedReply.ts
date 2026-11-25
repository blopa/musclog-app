import { normalizeMemoryText } from './coachMemories';

/** Length of the word run that is compared. */
export const COPY_RUN_WORDS = 6;
/** A reply is a copy when at least this share of its word runs occur in one earlier reply. */
export const COPY_SHARE_THRESHOLD = 0.5;

export function copyWords(text: string): string[] {
  return normalizeMemoryText(text)
    .split(' ')
    .filter((word) => word.length > 0);
}

function distinctRuns(words: readonly string[]): Set<string> {
  const runs = new Set<string>();

  for (let i = 0; i + COPY_RUN_WORDS <= words.length; i++) {
    runs.add(words.slice(i, i + COPY_RUN_WORDS).join(' '));
  }

  return runs;
}

export function sharedRunShare(reply: string, earlier: string): number {
  const replyWords = copyWords(reply);

  if (replyWords.length === 0) {
    return 0;
  }

  const earlierWords = copyWords(earlier);

  if (replyWords.length < COPY_RUN_WORDS) {
    const same =
      replyWords.length === earlierWords.length &&
      replyWords.every((word, index) => word === earlierWords[index]);

    return same ? 1 : 0;
  }

  const replyRuns = distinctRuns(replyWords);
  const earlierRuns = distinctRuns(earlierWords);
  let shared = 0;

  for (const run of replyRuns) {
    if (earlierRuns.has(run)) {
      shared += 1;
    }
  }

  return shared / replyRuns.size;
}

export function copiedShare(reply: string, earlierReplies: readonly string[]): number {
  let best = 0;

  for (const earlier of earlierReplies) {
    best = Math.max(best, sharedRunShare(reply, earlier));
  }

  return best;
}

export function isCopiedReply(reply: string, earlierReplies: readonly string[]): boolean {
  return copiedShare(reply, earlierReplies) >= COPY_SHARE_THRESHOLD;
}

export type CopyGate = {
  push(delta: string): void;
  finish(): void;
  reset(): void;
  isCopied(): boolean;
};

type GateState = 'undecided' | 'released' | 'copied';

export function createCopyGate(options: {
  earlierReplies: readonly string[];
  windowWords: number;
  clean?: (raw: string) => string;
  release: (delta: string) => void;
  onCopied: () => void;
}): CopyGate {
  const { earlierReplies, windowWords, clean, release, onCopied } = options;
  let state: GateState = 'undecided';
  let buffer = '';

  const countWords = (raw: string): string[] => copyWords(clean ? clean(raw) : raw);

  const decide = (words: string[]): void => {
    const copied = isCopiedReply(words.join(' '), earlierReplies);
    const held = buffer;

    buffer = '';

    if (copied) {
      state = 'copied';
      onCopied();

      return;
    }

    state = 'released';
    release(held);
  };

  return {
    push(delta: string): void {
      if (state === 'released') {
        release(delta);

        return;
      }

      if (state === 'copied') {
        return;
      }

      buffer += delta;

      const words = countWords(buffer);

      if (words.length >= windowWords) {
        decide(words.slice(0, windowWords));
      }
    },
    finish(): void {
      if (state !== 'undecided') {
        return;
      }

      const words = countWords(buffer);

      if (words.length === 0) {
        return;
      }

      decide(words);
    },
    reset(): void {
      state = 'undecided';
      buffer = '';
    },
    isCopied(): boolean {
      return state === 'copied';
    },
  };
}
