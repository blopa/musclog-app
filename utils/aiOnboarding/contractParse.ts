import {
  type AnswerWarning,
  CONTRACT_MAJOR,
  CONTRACT_SCHEMA_ID,
  type FieldIssue,
  KNOWN_DOCUMENT_KEYS,
  MAX_CONTRACT_BYTES,
  normalizeAnswers,
  type OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';

export type ContractParseError =
  | 'empty'
  | 'tooLarge'
  | 'notJson'
  | 'notAnObject'
  | 'wrongSchema'
  | 'newerVersion'
  | 'invalidVersion';

export type ContractParseResult =
  | {
      ok: true;
      draft: OnboardingAnswersDraft;
      issues: FieldIssue[];
      /** Dotted paths of keys the contract does not know; they were ignored, never applied. */
      droppedKeys: string[];
      warnings: AnswerWarning[];
    }
  | { ok: false; error: ContractParseError };

export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // A surrogate pair encodes one code point in 4 bytes.
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}

function firstBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

/**
 * Assistants wrap JSON in code fences or add a sentence around it. Prefer a fenced block, then the
 * first balanced object; plain JSON passes through untouched.
 */
export function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fenced = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(trimmed);
  if (fenced?.[1]?.trim()) {
    return firstBalancedObject(fenced[1]) ?? fenced[1].trim();
  }

  return firstBalancedObject(trimmed);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function unknownKeys(value: unknown, known: readonly string[], path: string): string[] {
  return isRecord(value)
    ? Object.keys(value)
        .filter((key) => !known.includes(key))
        .map((key) => (path ? `${path}.${key}` : key))
    : [];
}

function collectDroppedKeys(document: Record<string, unknown>): string[] {
  const dropped = unknownKeys(document, KNOWN_DOCUMENT_KEYS.top, '');
  dropped.push(...unknownKeys(document.height, KNOWN_DOCUMENT_KEYS.height, 'height'));
  dropped.push(...unknownKeys(document.weight, KNOWN_DOCUMENT_KEYS.weight, 'weight'));
  dropped.push(...unknownKeys(document.training, KNOWN_DOCUMENT_KEYS.training, 'training'));
  if (isRecord(document.training)) {
    dropped.push(
      ...unknownKeys(
        document.training.comingBack,
        KNOWN_DOCUMENT_KEYS.comingBack,
        'training.comingBack'
      )
    );
  }

  return dropped;
}

/**
 * Reads pasted or imported text as an onboarding document. Everything inside is data: it is
 * length-capped, schema-identified, version-checked and then validated field by field. A newer
 * major version is refused rather than half-understood; extra keys within the version we know are
 * ignored and reported.
 */
export function parseContractText(text: string, today: Date): ContractParseResult {
  if (!text.trim()) {
    return { ok: false, error: 'empty' };
  }

  if (utf8ByteLength(text) > MAX_CONTRACT_BYTES) {
    return { ok: false, error: 'tooLarge' };
  }

  const candidate = extractJsonCandidate(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate ?? text);
  } catch {
    return { ok: false, error: 'notJson' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'notAnObject' };
  }

  if (parsed.schema !== CONTRACT_SCHEMA_ID) {
    return { ok: false, error: 'wrongSchema' };
  }

  const version = parsed.version;
  if (typeof version !== 'number' || !Number.isFinite(version) || version < 1) {
    return { ok: false, error: 'invalidVersion' };
  }

  if (Math.trunc(version) > CONTRACT_MAJOR) {
    return { ok: false, error: 'newerVersion' };
  }

  const { draft, issues, warnings } = normalizeAnswers(parsed, today);
  return { ok: true, draft, issues, droppedKeys: collectDroppedKeys(parsed), warnings };
}
