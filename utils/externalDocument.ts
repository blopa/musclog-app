import { isRecord } from '@/utils/isRecord';

/**
 * What every document that comes back from outside the app has in common (an onboarding answer
 * file, a workout plan, a food log): the same JSON envelope of `schema` and `version`, the same
 * ways it can be unusable, and the same reading of free text. Each contract adds its own body.
 */

/** The ways the envelope itself can be refused, before anyone reads the body. */
export type EnvelopeError = 'notAnObject' | 'wrongSchema' | 'invalidVersion' | 'newerVersion';

/** Every way a pasted, imported or linked document can be refused before its body is read. */
export type DocumentParseError = 'empty' | 'tooLarge' | 'notJson' | EnvelopeError;

/** The refusals a contract's normalizer can give: everything except the ones raised before it runs. */
export type NormalizerError<E extends string> = Exclude<E, 'empty' | 'tooLarge' | 'notJson'>;

export type EnvelopeResult =
  { ok: true; record: Record<string, unknown> } | { ok: false; error: EnvelopeError };

/**
 * Checks that `raw` is an object of this contract's `schemaId` and a major version this build
 * understands. A fractional version is a minor revision of its integer part (`1.2` is major 1), so
 * only the integer part is compared; a missing, non-numeric or sub-1 version is invalid.
 */
export function readEnvelope(
  raw: unknown,
  { schemaId, major }: { schemaId: string; major: number }
): EnvelopeResult {
  if (!isRecord(raw)) {
    return { ok: false, error: 'notAnObject' };
  }

  if (raw.schema !== schemaId) {
    return { ok: false, error: 'wrongSchema' };
  }

  const version = raw.version;
  if (typeof version !== 'number' || !Number.isFinite(version) || version < 1) {
    return { ok: false, error: 'invalidVersion' };
  }

  if (Math.trunc(version) > major) {
    return { ok: false, error: 'newerVersion' };
  }

  return { ok: true, record: raw };
}

/** A trimmed, length-capped string; anything that is not text, or is blank, is nothing. */
export function trimmedText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}
