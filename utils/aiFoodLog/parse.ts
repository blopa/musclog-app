import { documentParser } from '@/utils/openLinkDocument';

import {
  type FoodLogDraft,
  type FoodLogParseError,
  MAX_FOOD_LOG_BYTES,
  normalizeFoodLog,
} from './contract';

export type FoodLogParseResult =
  { ok: true; log: FoodLogDraft; skippedFoods: number } | { ok: false; error: FoodLogParseError };

/**
 * Reads pasted, imported or linked text as a food log. The JSON is pulled out of any code fence or
 * sentence the assistant wrapped around it, or out of an open link (`/open#food=…`) anywhere in the
 * text (`readDocumentText`), is length-capped, and is then identified, version-checked and
 * validated by {@link normalizeFoodLog}.
 */
export const parseFoodLogText = documentParser<FoodLogParseResult>({
  kind: 'food',
  maxBytes: MAX_FOOD_LOG_BYTES,
  normalize: normalizeFoodLog,
  fail: (error) => ({ ok: false, error }),
});
