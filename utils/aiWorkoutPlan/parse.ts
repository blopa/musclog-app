import { parseJsonDocument, readDocumentText } from '@/utils/openLinkDocument';

import {
  MAX_PLAN_BYTES,
  normalizeWorkoutPlan,
  type PlanParseError,
  type WorkoutPlanDraft,
} from './contract';

export type PlanParseResult =
  | { ok: true; plan: WorkoutPlanDraft; skippedExercises: number }
  | { ok: false; error: PlanParseError };

const fail = (error: PlanParseError): PlanParseResult => ({ ok: false, error });

/**
 * Reads pasted, imported or linked text as a workout plan. The JSON is pulled out of any code fence
 * or sentence the assistant wrapped around it, or out of an open link (`/open#workout=…`) anywhere
 * in the text (`readDocumentText`), is length-capped, and is then identified, version-checked and
 * validated by {@link normalizeWorkoutPlan}.
 */
export function parseWorkoutPlanText(text: string): PlanParseResult {
  return readDocumentText<PlanParseResult>({
    text,
    kind: 'workout',
    maxBytes: MAX_PLAN_BYTES,
    parseJson: (json) => parseJsonDocument(json, normalizeWorkoutPlan, fail),
    fail,
  });
}
