/**
 * Cleaning for what the downloaded on-device model writes: chat-template control tokens it leaks
 * into a reply, the JSON inside surrounding text, and almost-JSON repaired with `jsonrepair`.
 */
import { jsonrepair } from 'jsonrepair';

import { validateAgainstSchema } from './aiSchemaValidate';

/**
 * Chat-template control tokens (`<|im_start|>`, `<|im_end|>`, …) that the downloaded model can leak
 * into its reply, and the role word that follows a start token. The Pixel 10 Pro's first real
 * photo replies were `<|im_start|>assistant { "items": [...] }`: valid JSON behind a template header.
 */
const TEMPLATE_HEADER =
  /<\|(?:im_start|start_header_id|start_of_turn)\|>\s*(?:(?:assistant|model)\b)?/gi;
const TEMPLATE_TOKEN = /<\|[A-Za-z0-9_]+\|>/g;

export function stripTemplateTokens(text: string): string {
  return text.replace(TEMPLATE_HEADER, '').replace(TEMPLATE_TOKEN, '').trim();
}

/**
 * The end of a stream that may still become a template token: a lone `<`, a half-written `<|im_e`,
 * or a complete header whose role word is still arriving (`<|im_start|>assi`).
 */
const PARTIAL_TEMPLATE_TOKEN = /<(?:\|[A-Za-z0-9_]*\|?)?$/;
const HEADER_WITH_PARTIAL_ROLE = /<\|(?:im_start|start_header_id|start_of_turn)\|>\s*([A-Za-z]*)$/;
const ROLE_WORDS = ['assistant', 'model'];

/**
 * `stripTemplateTokens` for text that is still being streamed: whatever may still turn into a
 * token is held back until the next chunk says, so nothing flickers on screen and off again. Only
 * the start is trimmed: the trailing space of a word still being written is kept.
 */
export function stripStreamingTemplateTokens(text: string): string {
  let held = text;
  const header = HEADER_WITH_PARTIAL_ROLE.exec(held);
  if (header && ROLE_WORDS.some((role) => role.startsWith(header[1].toLowerCase()))) {
    held = held.slice(0, header.index);
  }

  return held
    .replace(PARTIAL_TEMPLATE_TOKEN, '')
    .replace(TEMPLATE_HEADER, '')
    .replace(TEMPLATE_TOKEN, '')
    .trimStart();
}

/**
 * The JSON inside a reply that has other text around it: from the first `{` or `[` to the last
 * matching closer. Null when there is no such span. The caller still parses and schema-checks it.
 */
export function jsonSpan(text: string): string | null {
  const start = text.search(/[{[]/);
  if (start === -1) {
    return null;
  }

  const closer = text[start] === '{' ? '}' : ']';
  const end = text.lastIndexOf(closer);

  return end > start ? text.slice(start, end + 1) : null;
}

/**
 * Parses almost-JSON with `jsonrepair` (trailing commas, single quotes, unquoted keys, a reply cut
 * off by the token limit) and returns the value, or `undefined` when nothing usable can be made of
 * the text. `jsonrepair` rejects prose around the JSON, so it is given the balanced span first and
 * the text from the first bracket second (a truncated reply has no closing bracket to end a span).
 * The caller still checks the value against its schema.
 */
export function repairReplyJson(text: string): unknown {
  const start = text.search(/[{[]/);
  if (start === -1) {
    return undefined;
  }

  const candidates = [jsonSpan(text), text.slice(start)];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      return JSON.parse(jsonrepair(candidate));
    } catch {
      // Try the next candidate.
    }
  }

  return undefined;
}

/** The most of a broken reply sent back for repair; real replies are a few hundred characters. */
export const MAX_JSON_REPAIR_INPUT_CHARS = 2000;

/**
 * System prompt of the last-resort repair call: text only, the schema the reply had to match. Used
 * for any local model's structured reply; the photo flow keeps its own food-specific wording.
 */
export function jsonRepairPrompt(schema: object): string {
  return [
    'You repair one malformed JSON reply. Return only the corrected JSON, with no other text.',
    `It must match this JSON Schema: ${JSON.stringify(schema)}`,
    'Keep every value that can be read. Do not invent values or change amounts. Drop any item that cannot be read.',
  ].join('\n');
}

export function jsonRepairMessage(broken: string): string {
  return `Malformed JSON:\n${broken.slice(0, MAX_JSON_REPAIR_INPUT_CHARS)}`;
}

export type StructuredResult<T = unknown> =
  | { kind: 'ok'; value: T }
  | {
      kind: 'malformed';
      raw: string;
      /**
       * Set when the provider cut the reply off at its token limit and the reply was therefore not
       * repaired. `finishReason` is the provider's own stop signal, never reply content.
       */
      reason?: 'truncated';
      finishReason?: string;
    };

const MALFORMED_RAW_PREVIEW_CHARS = 500;

/**
 * The shape gate for a small local model (the downloaded one or a custom server): a value that
 * parsed but does not match the schema it was asked for is `malformed`, so no feature normalizer
 * reads it unchecked. A result that already passed comes back unchanged. Cloud providers enforce the
 * schema server-side, so their replies are not checked.
 */
export function checkStructuredShape<T>(
  result: StructuredResult<T>,
  schema: object,
  operation: string
): StructuredResult<T> {
  if (result.kind !== 'ok') {
    return result;
  }

  const check = validateAgainstSchema(result.value, schema);
  if (check.ok) {
    return result;
  }

  // The path names a field, never a value, so nothing the person wrote is logged.
  console.warn(`[coachAI] ${operation}: local reply failed the schema at ${check.path}`);

  return {
    kind: 'malformed',
    raw: JSON.stringify(result.value).slice(0, MALFORMED_RAW_PREVIEW_CHARS),
  };
}

export function parseStructuredJson<T>(raw: string): StructuredResult<T> {
  const clean = stripTemplateTokens(raw.replace(/```json|```/g, ''));
  if (clean) {
    try {
      return { kind: 'ok', value: JSON.parse(clean) as T };
    } catch {
      // Not plain JSON: try the JSON inside the text before calling it malformed.
    }

    const span = jsonSpan(clean);
    if (span) {
      try {
        return { kind: 'ok', value: JSON.parse(span) as T };
      } catch {
        // Try the repair below.
      }
    }

    // Almost-JSON (trailing commas, single quotes, a reply cut off by the token limit). The schema
    // check that follows is still the judge of whether the repaired value is usable.
    const repaired = repairReplyJson(clean);
    if (repaired !== undefined) {
      return { kind: 'ok', value: repaired as T };
    }
  }

  return { kind: 'malformed', raw: raw.slice(0, MALFORMED_RAW_PREVIEW_CHARS) };
}
