/** A note longer than this is a document, not a cue; it also bounds what the session pins above a set. */
export const MAX_NOTE_LENGTH = 1000;

/**
 * What to store for a note someone typed: trimmed, capped, and `undefined` when nothing is left —
 * a blank note is no note, so "has a note" and "has a row value" mean the same thing everywhere.
 */
export function normalizeNote(raw: string | null | undefined): string | undefined {
  return raw?.trim().slice(0, MAX_NOTE_LENGTH) || undefined;
}
