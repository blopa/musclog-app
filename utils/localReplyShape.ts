/**
 * Why a reply from the downloaded on-device model was rejected, in words that are safe to send to
 * Sentry. A rejected reply leaves no exception, so without this an event says only "bad shape".
 *
 * Nothing the model wrote leaves the phone through here: JSON is reduced to its keys and the type
 * of each value, and anything that is not JSON has every run of letters and digits flattened. The
 * full text goes to `adb logcat` only (`LOCAL_MODEL_LOG_TAG`), never to Sentry.
 */
import { validateAgainstSchema } from './aiSchemaValidate';

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
    return { reason: 'not-json', skeleton: flatten(clean) };
  }

  const check = validateAgainstSchema(value, schema);

  return {
    reason: check.ok ? 'schema-ok' : `schema ${check.path}: ${check.message}`,
    skeleton: skeleton(value, 0).slice(0, MAX_SKELETON_CHARS),
  };
}
