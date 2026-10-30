/**
 * Reads one top-level string field out of a JSON object that is still being generated.
 *
 * The coach's free-chat reply is a JSON object (`msg4User`, `sumMsg`, …) but only `msg4User` is
 * shown, and it is the first property, so it can be displayed while the rest is still arriving.
 * The reader works on the whole text received so far, so a chunk may end anywhere — inside an
 * escape, inside a `\uXXXX`, between a surrogate pair. What is returned is always a prefix of the
 * value `JSON.parse` will give once the object is complete; the complete text, not this, is what
 * gets saved.
 *
 * Output that is evidently not a JSON object (a local model that ignored the schema) is passed
 * through as is, which is what `parseCoachResponse` does with such a reply.
 */

const FENCE = '```json';
const SIMPLE_ESCAPES: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

type Scan<T> = { done: true; value: T; end: number } | { done: false };

const WHITESPACE = /\s/;

function skipWhitespace(raw: string, from: number): number {
  let i = from;
  while (i < raw.length && WHITESPACE.test(raw[i])) {
    i += 1;
  }

  return i;
}

/**
 * Decodes the JSON string starting at `raw[start]` (the opening quote). `done` is false while the
 * closing quote has not arrived, and `value` then is still the readable prefix.
 */
function decodeString(raw: string, start: number): { value: string; end: number; closed: boolean } {
  let value = '';
  let i = start + 1;
  while (i < raw.length) {
    const char = raw[i];
    if (char === '"') {
      return { value, end: i + 1, closed: true };
    }

    if (char !== '\\') {
      value += char;
      i += 1;
      continue;
    }

    const next = raw[i + 1];
    if (next === undefined) {
      break; // the escape is split across chunks
    }

    if (next === 'u') {
      const hex = raw.slice(i + 2, i + 6);
      if (hex.length < 4) {
        break;
      }

      const code = Number.parseInt(hex, 16);
      if (Number.isNaN(code)) {
        // Malformed escape: keep it literally rather than lose the rest of the reply.
        value += '\\u';
        i += 2;
        continue;
      }

      value += String.fromCharCode(code);
      i += 6;
      continue;
    }

    value += SIMPLE_ESCAPES[next] ?? next;
    i += 2;
  }

  return { value, end: raw.length, closed: false };
}

/** Skips one JSON value of any type, so the scan can move on to the next key. */
function skipValue(raw: string, from: number): Scan<null> {
  const start = skipWhitespace(raw, from);
  if (start >= raw.length) {
    return { done: false };
  }

  const first = raw[start];
  if (first === '"') {
    const { end, closed } = decodeString(raw, start);
    return closed ? { done: true, value: null, end } : { done: false };
  }

  if (first === '{' || first === '[') {
    let depth = 0;
    let i = start;
    while (i < raw.length) {
      const char = raw[i];
      if (char === '"') {
        const { end, closed } = decodeString(raw, i);
        if (!closed) {
          return { done: false };
        }

        i = end;
        continue;
      }

      if (char === '{' || char === '[') {
        depth += 1;
      } else if (char === '}' || char === ']') {
        depth -= 1;
        if (depth === 0) {
          return { done: true, value: null, end: i + 1 };
        }
      }

      i += 1;
    }

    return { done: false };
  }

  // number, true, false, null: runs until a delimiter, which has to be there to know it ended
  let i = start;
  while (i < raw.length && raw[i] !== ',' && raw[i] !== '}') {
    i += 1;
  }

  return i < raw.length ? { done: true, value: null, end: i } : { done: false };
}

/** Drops a trailing high surrogate, which would render as a replacement character until its pair arrives. */
function withoutDanglingSurrogate(value: string): string {
  const last = value.charCodeAt(value.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? value.slice(0, -1) : value;
}

/**
 * The readable prefix of `field` in the (possibly incomplete) JSON `raw`; `''` while it has not
 * started. Anything that is not a JSON object is returned unchanged.
 */
export function readJsonStringField(raw: string, field: string): string {
  let text = raw.trimStart();
  if (text.startsWith('`')) {
    // "```json\n{…" — also while the fence itself is still arriving.
    if (text.length < FENCE.length && FENCE.startsWith(text.toLowerCase())) {
      return '';
    }

    text = text.replace(/^```(?:json)?\s*/i, '');
  }

  if (!text) {
    return '';
  }

  if (text[0] !== '{') {
    return text;
  }

  let i = 1;
  while (i < text.length) {
    i = skipWhitespace(text, i);
    if (text[i] === ',') {
      i = skipWhitespace(text, i + 1);
    }

    if (i >= text.length || text[i] === '}') {
      return '';
    }

    if (text[i] !== '"') {
      return ''; // not the object we expect; the complete parse will decide what to show
    }

    const key = decodeString(text, i);
    if (!key.closed) {
      return '';
    }

    i = skipWhitespace(text, key.end);
    if (text[i] !== ':') {
      return '';
    }

    i = skipWhitespace(text, i + 1);
    if (key.value === field) {
      if (text[i] !== '"') {
        return '';
      }

      const value = decodeString(text, i);
      return value.closed ? value.value : withoutDanglingSurrogate(value.value);
    }

    const skipped = skipValue(text, i);
    if (!skipped.done) {
      return '';
    }

    i = skipped.end;
  }

  return '';
}

export type JsonStringFieldReader = {
  /** Adds a chunk and returns everything readable so far. */
  push: (chunk: string) => string;
  /** Everything received, unparsed. */
  raw: () => string;
};

export function createJsonStringFieldReader(field: string): JsonStringFieldReader {
  let raw = '';

  return {
    push: (chunk) => {
      raw += chunk;
      return readJsonStringField(raw, field);
    },
    raw: () => raw,
  };
}
