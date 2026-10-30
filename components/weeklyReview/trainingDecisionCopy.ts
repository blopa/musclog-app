import type {
  ConsistencyStatus,
  OneRmStatus,
  TrainingDecision,
  TrainingReasonCode,
} from '@/utils/trainingWeekDecision';

/**
 * Whole translation keys, never suffixes completed at the call site: `scripts/check-translations.js`
 * only sees literal keys, so a built-up `trainingDecision.${x}.title` would read as unused.
 */
export const DECISION_COPY = {
  progress: {
    title: 'weeklyReview.trainingDecision.progress.title',
    description: 'weeklyReview.trainingDecision.progress.description',
    confirm: 'weeklyReview.trainingDecision.progress.confirm',
    chosen: 'weeklyReview.trainingDecision.progress.chosen',
  },
  repeat: {
    title: 'weeklyReview.trainingDecision.repeat.title',
    description: 'weeklyReview.trainingDecision.repeat.description',
    confirm: 'weeklyReview.trainingDecision.repeat.confirm',
    chosen: 'weeklyReview.trainingDecision.repeat.chosen',
  },
  lighter: {
    title: 'weeklyReview.trainingDecision.lighter.title',
    description: 'weeklyReview.trainingDecision.lighter.description',
    confirm: 'weeklyReview.trainingDecision.lighter.confirm',
    chosen: 'weeklyReview.trainingDecision.lighter.chosen',
  },
} as const satisfies Record<TrainingDecision, Record<string, string>>;

export const REASON_KEYS = {
  noWorkouts: 'weeklyReview.reasons.noWorkouts',
  missedConsistency: 'weeklyReview.reasons.missedConsistency',
  repeatedDeloads: 'weeklyReview.reasons.repeatedDeloads',
  lowReserveStalled: 'weeklyReview.reasons.lowReserveStalled',
  dueForLighter: 'weeklyReview.reasons.dueForLighter',
  onTrack: 'weeklyReview.reasons.onTrack',
  comeback: 'weeklyReview.reasons.comeback',
} as const satisfies Record<TrainingReasonCode, string>;

export const CONSISTENCY_STATUS_KEYS = {
  met: 'weeklyReview.goals.status.met',
  missed: 'weeklyReview.goals.status.missed',
  exceeded: 'weeklyReview.goals.status.exceeded',
} as const satisfies Record<ConsistencyStatus, string>;

export const ONE_RM_STATUS_KEYS = {
  reached: 'weeklyReview.goals.oneRm.reached',
  onPace: 'weeklyReview.goals.oneRm.onPace',
  behind: 'weeklyReview.goals.oneRm.behind',
  stalling: 'weeklyReview.goals.oneRm.stalling',
  declining: 'weeklyReview.goals.oneRm.declining',
  notEnoughData: 'weeklyReview.goals.oneRm.notEnoughData',
} as const satisfies Record<OneRmStatus, string>;

/** Whether a verdict is good news, so the pill can be tinted and not only worded. */
export const isGoodStatus = (status: ConsistencyStatus | OneRmStatus): boolean =>
  status === 'met' || status === 'exceeded' || status === 'reached' || status === 'onPace';

/** The history line for a review: what was decided for training, then for nutrition. */
export function historyLabelKeys(review: {
  trainingDecision?: TrainingDecision | null;
  nutritionDecision?: string | null;
}): string[] {
  const keys: string[] = [];
  if (review.trainingDecision) {
    keys.push(DECISION_COPY[review.trainingDecision].title);
  }

  if (review.nutritionDecision === 'apply') {
    keys.push('weeklyReview.applied');
  } else if (review.nutritionDecision === 'keep') {
    keys.push('weeklyReview.kept');
  }

  // A legacy row: training was only acknowledged, and nutrition may be undecided.
  return keys.length ? keys : ['weeklyReview.trainingOnly'];
}
