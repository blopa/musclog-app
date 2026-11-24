/**
 * Cleaning for what the downloaded on-device model writes: chat-template control tokens it leaks
 * into a reply, the JSON inside surrounding text, and almost-JSON repaired with `jsonrepair`.
 */
import { jsonrepair } from 'jsonrepair';

/**
 * Chat-template control tokens (`<|im_start|>`, `<|im_end|>`, …) that the downloaded model can leak
 * into its reply, and the role word that follows a start token. The Pixel 10 Pro's first real
 * photo replies were `<|im_start|>assistant { "items": [...] }`: valid JSON behind a template header.
 */
const TEMPLATE_HEADER = /<\|(?:im_start|start_header_id|start_of_turn)\|>\s*(?:assistant|model)?/gi;
const TEMPLATE_TOKEN = /<\|[A-Za-z0-9_]+\|>/g;

export function stripTemplateTokens(text: string): string {
  return text.replace(TEMPLATE_HEADER, '').replace(TEMPLATE_TOKEN, '').trim();
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
