/** Matches the marker lines `getChatReviewInstruction` (`utils/prompts.ts`) fences its quoted text with. */
const REVIEW_FENCE_PATTERN = /^[ \t]*(?:<<<(?:DRAFT|MESSAGE)|(?:DRAFT|MESSAGE)>>>)[ \t]*\r?\n?/gm;

/**
 * A reviewed reply with the review prompt's fence lines taken out. A model told to return the draft
 * "word for word" can copy the `<<<DRAFT` / `DRAFT>>>` lines it was quoted in; they are never part
 * of an answer.
 */
export const stripReviewFences = (reply: string): string =>
  reply.replace(REVIEW_FENCE_PATTERN, '').trim();
