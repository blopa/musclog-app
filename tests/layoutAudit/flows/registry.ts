import type { FlowRunner } from '@/tests/layoutAudit/flowKit';
import { comebackFlow } from '@/tests/layoutAudit/flows/comeback';
import { cycleFlow } from '@/tests/layoutAudit/flows/cycle';
import { diaryFlow } from '@/tests/layoutAudit/flows/diary';
import { weeklyReviewFlow } from '@/tests/layoutAudit/flows/weeklyReview';
import { whatsNewFlow } from '@/tests/layoutAudit/flows/whatsNew';
import { workoutFlow } from '@/tests/layoutAudit/flows/workout';

/**
 * The code behind each `AUDIT_FLOWS` entry, by its name. `routes.test.ts` checks the two lists
 * name the same flows, so a declared flow cannot be left without a runner.
 */
export const FLOW_RUNNERS: Record<string, FlowRunner> = {
  workout: workoutFlow,
  'whats-new': whatsNewFlow,
  'weekly-review-flow': weeklyReviewFlow,
  'comeback-flow': comebackFlow,
  diary: diaryFlow,
  'cycle-flow': cycleFlow,
};
