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

// Gemma's turn header has no `|`, and a few other templates use plain `<s>` or `[INST]` markers.
const BARE_TEMPLATE_HEADER = /<start_of_turn>\s*(?:(?:assistant|model)\b)?/gi;
const BARE_TEMPLATE_MARKERS = [
  '<end_of_turn>',
  '<bos>',
  '<eos>',
  '<s>',
  '</s>',
  '[INST]',
  '[/INST]',
];

const BARE_TEMPLATE_MARKER = new RegExp(
  BARE_TEMPLATE_MARKERS.map((marker) => marker.replace(/[[\]/]/g, '\\$&')).join('|'),
  'gi'
);

/**
 * Tags a reasoning model wraps its thinking in. The thinking is never an answer, and it may hold
 * braces that would be mistaken for the JSON. One entry per tag name: add a new one here.
 */
const REASONING_TAGS = ['think', 'thinking', 'reasoning'];
const REASONING_NAMES = REASONING_TAGS.join('|');
const REASONING_BLOCK = new RegExp(`<(${REASONING_NAMES})>[\\s\\S]*?</\\1>`, 'gi');
// Templates such as Qwen3 and DeepSeek-R1 put the opening tag in the prompt, so the reply starts
// inside the block: everything up to the first closing tag is reasoning.
const REASONING_CLOSE_ONLY = new RegExp(`^[\\s\\S]*?</(?:${REASONING_NAMES})>`, 'i');
const REASONING_OPEN = new RegExp(`<(?:${REASONING_NAMES})>`, 'i');

/** Removes reasoning blocks; text after an opening tag that never closes is unfinished reasoning. */
function stripReasoning(text: string): string {
  let result = text.replace(REASONING_BLOCK, '').replace(REASONING_CLOSE_ONLY, '');
  const open = REASONING_OPEN.exec(result);
  if (open) {
    result = result.slice(0, open.index);
  }

  return result;
}

function stripMarkers(text: string): string {
  return text
    .replace(TEMPLATE_HEADER, '')
    .replace(BARE_TEMPLATE_HEADER, '')
    .replace(TEMPLATE_TOKEN, '')
    .replace(BARE_TEMPLATE_MARKER, '');
}

export function stripTemplateTokens(text: string): string {
  return stripMarkers(stripReasoning(text)).trim();
}

/**
 * The end of a stream that may still become a template token: a lone `<`, a half-written `<|im_e`,
 * or a complete header whose role word is still arriving (`<|im_start|>assi`).
 */
const PARTIAL_TEMPLATE_TOKEN = /<(?:\|[A-Za-z0-9_]*\|?)?$/;
const HEADER_WITH_PARTIAL_ROLE =
  /(?:<\|(?:im_start|start_header_id|start_of_turn)\|>|<start_of_turn>)\s*([A-Za-z]*)$/;
const ROLE_WORDS = ['assistant', 'model'];

// Whole tags a stream may still be spelling out, so a trailing `<thi` or `[IN` is held back.
const SPELLED_TAGS = [
  ...REASONING_TAGS.flatMap((tag) => [`<${tag}>`, `</${tag}>`]),
  '<start_of_turn>',
  ...BARE_TEMPLATE_MARKERS,
];

function endsWithPartialTag(text: string): number {
  const lower = text.toLowerCase();
  let cut = text.length;

  for (const tag of SPELLED_TAGS) {
    const lowerTag = tag.toLowerCase();
    for (let length = Math.min(lowerTag.length - 1, lower.length); length > 0; length--) {
      if (lower.endsWith(lowerTag.slice(0, length))) {
        cut = Math.min(cut, text.length - length);
        break;
      }
    }
  }

  return cut;
}

/**
 * `stripTemplateTokens` for text that is still being streamed: whatever may still turn into a
 * token is held back until the next chunk says, so nothing flickers on screen and off again. Only
 * the start is trimmed: the trailing space of a word still being written is kept.
 */
export function stripStreamingTemplateTokens(text: string): string {
  let held = stripReasoning(text);
  const header = HEADER_WITH_PARTIAL_ROLE.exec(held);

  if (header && ROLE_WORDS.some((role) => role.startsWith(header[1].toLowerCase()))) {
    held = held.slice(0, header.index);
  }

  held = held.replace(PARTIAL_TEMPLATE_TOKEN, '');

  return stripMarkers(held.slice(0, endsWithPartialTag(held))).trimStart();
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

/**
 * The longest broken reply sent back for repair; real replies are a few hundred characters. A longer
 * one is not repaired at all (`repairStructuredWithModel`): sending part of it would get back a
 * "repaired" reply that lost the rest.
 */
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
  return `Malformed JSON:\n${broken}`;
}

export type StructuredResult<T = unknown> =
  | { kind: 'ok'; value: T }
  | {
      kind: 'malformed';
      /** The full reply text (or the value's JSON), so the repair request sees every item. */
      raw: string;
      /**
       * Set when the provider cut the reply off at its token limit and the reply was therefore not
       * repaired. `finishReason` is the provider's own stop signal, never reply content.
       */
      reason?: 'truncated';
      finishReason?: string;
    };

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
    raw: JSON.stringify(result.value),
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

  return { kind: 'malformed', raw };
}
