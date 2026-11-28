// What an error message may carry into a crash report. Pure.
//
// A message is written by whichever library failed, and some quote the value they choked on: a food
// name, a chat line, a request. This takes out what could be the person's, and keeps what a
// developer needs: the wording and the identifiers.

export const MAX_ERROR_TEXT_CHARS = 300;

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /\bAIza[0-9A-Za-z_-]{10,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
];
const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[A-Za-z]{2,}/g;
const URL_QUERY = /(\bhttps?:\/\/[^\s?#"']+)[?#][^\s"']*/g;
/** A quoted value that is not a plain identifier (it has a space, or is very long) is free text. */
const QUOTED = /(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;
const IDENTIFIER = /^[\w$.[\]()/-]{0,40}$/;
const OBJECT_BODY = /\{[^{}]*\}/g;

export function scrubErrorText(text: string): string {
  let result = text;

  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[secret]');
  }

  result = result
    .replace(EMAIL, '[email]')
    .replace(URL_QUERY, '$1')
    .replace(QUOTED, (match, quote: string, inner: string) =>
      IDENTIFIER.test(inner) ? match : `${quote}[text]${quote}`
    )
    .replace(OBJECT_BODY, '{…}');

  return result.slice(0, MAX_ERROR_TEXT_CHARS);
}
