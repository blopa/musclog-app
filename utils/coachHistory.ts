/**
 * What the coach sees of the conversation so far. Pure (no React Native, no database).
 *
 * The last `VERBATIM_TURNS` turns go back word for word, because the exact wording, the numbers and
 * the voice of the coach's own earlier replies are what make a reply feel like part of one
 * conversation. Older turns inside the window are shortened locally (never by asking the model for
 * a summary, which cost output tokens and put a neutral voice back into the history).
 *
 * Every USER turn is prefixed with the time it was sent, and the newest one also says how long it
 * has been since the previous message. Coach turns are never tagged: a model copies whatever its
 * own earlier turns look like, and the system prompt tells it not to write timestamps.
 */

/** Turns (user and coach) sent word for word. */
export const VERBATIM_TURNS = 12;

/** Turns of the conversation considered at all; older ones are not sent. */
export const HISTORY_WINDOW_TURNS = 30;

/** Longest a shortened older turn may be, in characters. */
export const OLD_TURN_MAX_CHARS = 280;

/** A pause at least this long is called out on the newest user message. */
export const LONG_PAUSE_MS = 12 * 60 * 60 * 1000;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Local `YYYY-MM-DD Ddd HH:mm`, the one date format every coach prompt uses. */
export function formatLocalDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${WEEKDAYS[d.getDay()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "5 hours", "3 days", "2 weeks", "4 months": how long a pause was, roughly. */
export function describePause(ms: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (ms < 2 * MS_PER_DAY) {
    return plural(Math.max(1, Math.round(ms / MS_PER_HOUR)), 'hour');
  }

  const days = Math.round(ms / MS_PER_DAY);
  if (days < 14) {
    return plural(days, 'day');
  }

  if (days < 60) {
    return plural(Math.round(days / 7), 'week');
  }

  return plural(Math.round(days / 30), 'month');
}

/**
 * The bracketed tag put in front of a user message. `previousAt` is when the message before this
 * one was sent (by either side); when the pause was long, the tag says so.
 */
export function timeTag(at: number, previousAt?: number | null): string {
  const base = formatLocalDateTime(at);
  if (previousAt != null && at - previousAt >= LONG_PAUSE_MS) {
    return `[${base} · ${describePause(at - previousAt)} since the last message]`;
  }

  return `[${base}]`;
}

/**
 * Shortens text to about `maxChars`, preferring to end at a sentence, then at a word. Used for
 * older turns and for the stored one-line version of a long reply.
 */
export function shortenForHistory(text: string, maxChars: number = OLD_TURN_MAX_CHARS): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= maxChars) {
    return flat;
  }

  const head = flat.slice(0, maxChars);
  const sentenceEnd = Math.max(
    head.lastIndexOf('. '),
    head.lastIndexOf('! '),
    head.lastIndexOf('? ')
  );
  if (sentenceEnd >= maxChars * 0.5) {
    return head.slice(0, sentenceEnd + 1);
  }

  const wordEnd = head.lastIndexOf(' ');
  return `${(wordEnd >= maxChars * 0.5 ? head.slice(0, wordEnd) : head).trimEnd()}…`;
}

export type HistoryTurn = {
  role: 'user' | 'coach';
  content: string;
  /** When the turn was sent (ms). */
  at?: number;
  /** Set on a turn that carries a finished workout, so the same session is not sent twice. */
  workoutLogId?: string;
};

/**
 * Tags every user turn and the new message with the time it was sent. Returns new objects; coach
 * turns are untouched. `now` is when the new message is sent.
 */
export function tagTurnsWithTime(
  history: readonly HistoryTurn[],
  userMessage: string,
  now: number
): { history: HistoryTurn[]; userMessage: string } {
  const tagged = history.map((turn, index) => {
    if (turn.role !== 'user' || turn.at == null) {
      return { ...turn };
    }

    return { ...turn, content: `${timeTag(turn.at, history[index - 1]?.at)} ${turn.content}` };
  });
  const lastAt = history.length > 0 ? history[history.length - 1].at : undefined;

  return { history: tagged, userMessage: `${timeTag(now, lastAt)} ${userMessage}` };
}

/** Where a turn counts from the end: 0 is the newest turn of the conversation. */
export function isVerbatimTurn(indexFromEnd: number): boolean {
  return indexFromEnd < VERBATIM_TURNS;
}

/**
 * The text of a turn as the history carries it: whole while recent, otherwise the stored summary
 * of an older conversation when there is one (rows from before this change have one), else a local
 * shortening.
 */
export function historyText(
  message: string,
  summarizedMessage: string | null | undefined,
  indexFromEnd: number
): string {
  if (isVerbatimTurn(indexFromEnd)) {
    return message;
  }

  return summarizedMessage?.trim() ? summarizedMessage : shortenForHistory(message);
}
