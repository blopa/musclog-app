import type { StartSetAdjustment } from '@/utils/setAdjustment';

/**
 * Whole translation keys, not suffixes completed at the call site: `scripts/check-translations.js`
 * only sees literal keys, so a built-up `adjustment.start${...}` would read as unused.
 */
export const START_ADJUSTMENT_MESSAGE_KEYS = {
  progressionWeight: 'workoutSession.adjustment.startProgressionWeight',
  progressionWeightReps: 'workoutSession.adjustment.startProgressionWeightReps',
  progressionReps: 'workoutSession.adjustment.startProgressionReps',
  deload: 'workoutSession.adjustment.startDeload',
  deloadWeightReps: 'workoutSession.adjustment.startDeloadWeightReps',
  repeatWeight: 'workoutSession.adjustment.startRepeatWeight',
  repeatWeightReps: 'workoutSession.adjustment.startRepeatWeightReps',
  repeatReps: 'workoutSession.adjustment.startRepeatReps',
  reviewLighter: 'workoutSession.adjustment.startReviewLighter',
  reviewRepeat: 'workoutSession.adjustment.startReviewRepeat',
} as const;

export type StartAdjustmentMessageKey =
  (typeof START_ADJUSTMENT_MESSAGE_KEYS)[keyof typeof START_ADJUSTMENT_MESSAGE_KEYS];

/**
 * Which sentence explains a start adjustment.
 *
 * The rule that matters: if the reps moved relative to the PLAN, the sentence says so. The set's
 * "adjusted" marker is drawn on every number that differs from the plan (`adjustedFields`), and a
 * marker with no explanation is exactly what this feature exists to prevent — which is how a
 * weight-only sentence once sat beside a reps card that was marked too.
 */
export function startAdjustmentMessageKey(
  adjustment: StartSetAdjustment
): StartAdjustmentMessageKey {
  // A repeated or lighter week the user chose in the Weekly Review credits the review, not how the
  // last session went — the sentence must not claim a reps-in-reserve figure that was not the cause.
  if (adjustment.source === 'weekly_review') {
    return adjustment.cause === 'deload'
      ? START_ADJUSTMENT_MESSAGE_KEYS.reviewLighter
      : START_ADJUSTMENT_MESSAGE_KEYS.reviewRepeat;
  }

  const repsMoved = adjustment.now.reps !== adjustment.plan.reps;

  switch (adjustment.cause) {
    case 'progression':
      if (adjustment.field === 'reps') {
        return START_ADJUSTMENT_MESSAGE_KEYS.progressionReps;
      }

      return repsMoved
        ? START_ADJUSTMENT_MESSAGE_KEYS.progressionWeightReps
        : START_ADJUSTMENT_MESSAGE_KEYS.progressionWeight;
    case 'deload':
      // A deload whose rounding landed back on the plan's weight leaves only the reps different.
      if (adjustment.field === 'reps') {
        return START_ADJUSTMENT_MESSAGE_KEYS.repeatReps;
      }

      return repsMoved
        ? START_ADJUSTMENT_MESSAGE_KEYS.deloadWeightReps
        : START_ADJUSTMENT_MESSAGE_KEYS.deload;
    case 'repeat':
      if (adjustment.field === 'reps') {
        return START_ADJUSTMENT_MESSAGE_KEYS.repeatReps;
      }

      return repsMoved
        ? START_ADJUSTMENT_MESSAGE_KEYS.repeatWeightReps
        : START_ADJUSTMENT_MESSAGE_KEYS.repeatWeight;
  }
}
