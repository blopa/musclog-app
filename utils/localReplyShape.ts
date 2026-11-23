/**
 * Why a reply from the downloaded on-device model was rejected, in words that are safe to send to
 * Sentry. A rejected reply leaves no exception, so without this an event says only "bad shape".
 *
 * Nothing the model wrote leaves the phone through here: JSON is reduced to its keys and the type
 * of each value, and anything that is not JSON has every run of letters and digits flattened. The
 * full text goes to `adb logcat` only (`LOCAL_MODEL_LOG_TAG`), never to Sentry.
 */
import { validateAgainstSchema } from './aiSchemaValidate';

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

const MAX_SKELETON_CHARS = 240;
const MAX_KEYS = 8;
const MAX_DEPTH = 4;

function skeleton(value: unknown, depth: number): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return value.length === 0 || depth >= MAX_DEPTH
      ? `[]x${value.length}`
      : `[${skeleton(value[0], depth + 1)}]x${value.length}`;
  }

  if (typeof value === 'object') {
    if (depth >= MAX_DEPTH) {
      return '{...}';
    }

    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS);
    const body = entries
      .map(
        ([key, child]) =>
          `${key.replace(/[^A-Za-z0-9_]/g, '?').slice(0, 24)}:${skeleton(child, depth + 1)}`
      )
      .join(',');

    return `{${body}}`;
  }

  return typeof value === 'string' ? 'str' : typeof value;
}

function flatten(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\p{L}]+/gu, 'a')
    .replace(/\d+/g, '9')
    .slice(0, MAX_SKELETON_CHARS);
}

export type LocalReplyDiagnosis = {
  /** `empty`, `not-json`, or `schema <path>: <message>` for JSON that does not fit. */
  reason: string;
  skeleton: string;
};

export function diagnoseLocalReply(raw: string, schema: object): LocalReplyDiagnosis {
  const clean = raw.replace(/```json|```/g, '').trim();
  if (!clean) {
    return { reason: 'empty', skeleton: '' };
  }

  let value: unknown;
  try {
    value = JSON.parse(clean);
  } catch {
    // Flattened from the raw text: stripping the template header would hide what the model did.
    return { reason: 'not-json', skeleton: flatten(clean) };
  }

  const check = validateAgainstSchema(value, schema);

  return {
    reason: check.ok ? 'schema-ok' : `schema ${check.path}: ${check.message}`,
    skeleton: skeleton(value, 0).slice(0, MAX_SKELETON_CHARS),
  };
}
