import { extractJsonCandidate, utf8ByteLength } from '@/utils/aiOnboarding/contractParse';

import {
  type FoodLogDraft,
  type FoodLogParseError,
  MAX_FOOD_LOG_BYTES,
  normalizeFoodLog,
} from './contract';

export type FoodLogParseResult =
  { ok: true; log: FoodLogDraft; skippedFoods: number } | { ok: false; error: FoodLogParseError };

/**
 * Reads pasted or imported text as a food log. The text is length-capped, the JSON is pulled out of
 * any code fence or sentence the assistant wrapped around it, and the document is then identified,
 * version-checked and validated by {@link normalizeFoodLog}.
 */
export function parseFoodLogText(text: string): FoodLogParseResult {
  if (!text.trim()) {
    return { ok: false, error: 'empty' };
  }

  if (utf8ByteLength(text) > MAX_FOOD_LOG_BYTES) {
    return { ok: false, error: 'tooLarge' };
  }

  const candidate = extractJsonCandidate(text);
  if (!candidate) {
    return { ok: false, error: 'notJson' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return { ok: false, error: 'notJson' };
  }

  return normalizeFoodLog(parsed);
}
