import { extractJsonCandidate, utf8ByteLength } from '@/utils/aiOnboarding/contractParse';
import { findOpenLinkInText, type OpenLinkKind } from '@/utils/openLink';

/** The parse failures every external document shares. */
export type OpenDocumentError = 'empty' | 'tooLarge' | 'notJson' | 'wrongSchema';

/** A pasted chat message can hold the link, the JSON block and prose, so the scan is bounded wider. */
const RAW_TEXT_FACTOR = 4;

/**
 * Reads pasted, imported or linked text as an external document (a workout plan, a food log).
 * One entry point for every way the document comes back:
 * - plain JSON, or JSON wrapped in a code fence or a sentence (`parseJson` handles that);
 * - an open link (`https://musclog.app/open#<kind>=…`) anywhere in the text, alone or inside a
 *   whole copied message. A link of the other kind is `wrongSchema`;
 * - a link that does not decode into a usable document falls back to a JSON block in the same text,
 *   so a mangled link never hides a good block.
 *
 * `maxBytes` caps what is actually parsed (the decoded payload or the extracted block); the raw text
 * only has a looser ceiling because a message carries prose around the data.
 */
export function readDocumentText<R extends { ok: boolean }>({
  text,
  kind,
  maxBytes,
  parseJson,
  fail,
}: {
  text: string;
  kind: OpenLinkKind;
  maxBytes: number;
  parseJson: (json: string) => R;
  fail: (error: OpenDocumentError) => R;
}): R {
  if (!text.trim()) {
    return fail('empty');
  }

  const rawBytes = utf8ByteLength(text);
  if (rawBytes > maxBytes * RAW_TEXT_FACTOR) {
    return fail('tooLarge');
  }

  const link = findOpenLinkInText(text);
  if (!link) {
    return rawBytes > maxBytes ? fail('tooLarge') : parseJson(text);
  }

  if (link.kind !== kind) {
    return fail('wrongSchema');
  }

  if (utf8ByteLength(link.payload) > maxBytes) {
    return fail('tooLarge');
  }

  const fromLink = parseJson(link.payload);
  if (fromLink.ok) {
    return fromLink;
  }

  const block = extractJsonCandidate(text);
  if (block && utf8ByteLength(block) <= maxBytes) {
    const fromBlock = parseJson(block);
    if (fromBlock.ok) {
      return fromBlock;
    }
  }

  return fromLink;
}

/** Parses JSON text out of whatever wraps it, mapping every failure to the shared errors. */
export function parseJsonDocument<R>(
  text: string,
  normalize: (parsed: unknown) => R,
  fail: (error: 'notJson') => R
): R {
  const candidate = extractJsonCandidate(text);
  if (!candidate) {
    return fail('notJson');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return fail('notJson');
  }

  return normalize(parsed);
}
