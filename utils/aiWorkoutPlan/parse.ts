import { extractJsonCandidate, utf8ByteLength } from '@/utils/aiOnboarding/contractParse';

import {
  MAX_PLAN_BYTES,
  normalizeWorkoutPlan,
  type PlanParseError,
  type WorkoutPlanDraft,
} from './contract';

export type PlanParseResult =
  | { ok: true; plan: WorkoutPlanDraft; skippedExercises: number }
  | { ok: false; error: PlanParseError };

/**
 * Reads pasted or imported text as a workout plan. The text is length-capped, the JSON is pulled
 * out of any code fence or sentence the assistant wrapped around it, and the document is then
 * identified, version-checked and validated by {@link normalizeWorkoutPlan}.
 */
export function parseWorkoutPlanText(text: string): PlanParseResult {
  if (!text.trim()) {
    return { ok: false, error: 'empty' };
  }

  if (utf8ByteLength(text) > MAX_PLAN_BYTES) {
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

  return normalizeWorkoutPlan(parsed);
}
