import type { FlowRunner } from '../flowKit';
import { comebackFlow } from './comeback';
import { cycleFlow } from './cycle';
import { diaryFlow } from './diary';
import { weeklyReviewFlow } from './weeklyReview';
import { whatsNewFlow } from './whatsNew';
import { workoutFlow } from './workout';

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
