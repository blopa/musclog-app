import type {
  ConsistencyStatus,
  GoalVerdict,
  OneRmStatus,
  TrainingDecision,
  TrainingReason,
} from '@/utils/trainingWeekDecision';

/** Rated working sets needed before "you are training at the limit" means anything. */
export const MIN_RATED_SETS = 6;
/** Average reps in reserve at or below which a week counts as grinding. */
export const GRINDING_AVERAGE_RIR = 0.5;
/** Exercises that deloaded on their own in one week before the whole week should follow suit. */
export const MIN_DELOADED_EXERCISES = 2;
/** Decided weeks without a lighter week after which one is suggested regardless of the numbers. */
export const LIGHTER_WEEK_INTERVAL = 6;
/** Reps in reserve a lighter week's planned sets aim for, so mid-session re-targeting stays easy. */
export const LIGHTER_WEEK_TARGET_RIR = 4;
/** A week with this share of the target or less (or fewer) is a disrupted week, not a slow one. */
const DISRUPTED_SHARE = 0.5;

/** Working sets kept in a lighter week: two thirds, never fewer than one. */
export const lighterSetCount = (workingSets: number): number =>
  workingSets <= 0 ? 0 : Math.max(1, Math.round((workingSets * 2) / 3));

export function consistencyStatus(done: number, target: number): ConsistencyStatus {
  if (done > target) {
    return 'exceeded';
  }

  return done === target ? 'met' : 'missed';
}

/** The shape of `ProjectionResult` this module needs, so it never imports the hook's types. */
export type GoalProjectionInput = {
  status:
    | 'on_track'
    | 'stalling'
    | 'declining'
    | 'achieved'
    | 'ready_to_achieve'
    | 'insufficient_data'
    | 'no_history';
  projectedDate: Date | null;
};

export function oneRmStatus(
  projection: GoalProjectionInput,
  targetDate?: string | null
): OneRmStatus {
  switch (projection.status) {
    case 'achieved':
    case 'ready_to_achieve':
      return 'reached';
    case 'stalling':
      return 'stalling';
    case 'declining':
      return 'declining';
    case 'insufficient_data':
    case 'no_history':
      return 'notEnoughData';
    case 'on_track': {
      const deadline = targetDate ? Date.parse(targetDate) : NaN;
      return projection.projectedDate &&
        Number.isFinite(deadline) &&
        projection.projectedDate.getTime() > deadline
        ? 'behind'
        : 'onPace';
    }
  }
}

export type ConsistencyGoalInput = { goalId: string; target: number };
export type OneRmGoalInput = {
  goalId: string;
  exerciseId: string;
  exerciseName: string;
  targetDate?: string | null;
  projection: GoalProjectionInput | null;
};

export function goalVerdicts(input: {
  workoutsThisWeek: number;
  consistency: ConsistencyGoalInput | null;
  oneRm: OneRmGoalInput[];
}): GoalVerdict[] {
  const verdicts: GoalVerdict[] = [];
  if (input.consistency) {
    verdicts.push({
      kind: 'consistency',
      goalId: input.consistency.goalId,
      target: input.consistency.target,
      done: input.workoutsThisWeek,
      status: consistencyStatus(input.workoutsThisWeek, input.consistency.target),
    });
  }

  for (const goal of input.oneRm) {
    verdicts.push({
      kind: '1rm',
      goalId: goal.goalId,
      exerciseId: goal.exerciseId,
      exerciseName: goal.exerciseName,
      status: goal.projection ? oneRmStatus(goal.projection, goal.targetDate) : 'notEnoughData',
      projectedDate: goal.projection?.projectedDate?.getTime() ?? null,
    });
  }

  return verdicts;
}

export type TrainingEvidence = {
  workoutsThisWeek: number;
  /** Whether the user has EVER finished a workout, which tells a week off from a first week. */
  everWorkout: boolean;
  /** Distinct exercises that deloaded on their own this week. */
  deloadedExercises: number;
  /** Working sets with a recorded reps-in-reserve, and their average. */
  ratedSets: number;
  averageRir: number | null;
  goals: GoalVerdict[];
  /** Weeks with a training decision since the last lighter week (all of them if never). */
  decidedWeeksSinceLighter: number;
};

export function recommendTrainingWeek(evidence: TrainingEvidence): {
  decision: TrainingDecision;
  reasons: TrainingReason[];
} {
  const reasons: TrainingReason[] = [];
  const goingBackwards = evidence.goals.some(
    (goal) => goal.kind === '1rm' && (goal.status === 'stalling' || goal.status === 'declining')
  );

  if (evidence.deloadedExercises >= MIN_DELOADED_EXERCISES) {
    reasons.push({ code: 'repeatedDeloads', count: evidence.deloadedExercises });
  }

  if (
    evidence.ratedSets >= MIN_RATED_SETS &&
    evidence.averageRir != null &&
    evidence.averageRir <= GRINDING_AVERAGE_RIR &&
    goingBackwards
  ) {
    reasons.push({ code: 'lowReserveStalled' });
  }

  if (evidence.decidedWeeksSinceLighter >= LIGHTER_WEEK_INTERVAL) {
    reasons.push({ code: 'dueForLighter', count: evidence.decidedWeeksSinceLighter });
  }

  if (reasons.length) {
    return { decision: 'lighter', reasons };
  }

  if (evidence.everWorkout && evidence.workoutsThisWeek === 0) {
    return { decision: 'repeat', reasons: [{ code: 'noWorkouts' }] };
  }

  const consistency = evidence.goals.find((goal) => goal.kind === 'consistency');
  if (
    consistency?.kind === 'consistency' &&
    consistency.status === 'missed' &&
    consistency.done <= consistency.target * DISRUPTED_SHARE
  ) {
    return { decision: 'repeat', reasons: [{ code: 'missedConsistency' }] };
  }

  return { decision: 'progress', reasons: [{ code: 'onTrack' }] };
}

export type ConsistencySuggestion = { kind: 'lower' | 'raise'; to: number };

/**
 * A change to the workouts-per-week goal, offered only after TWO weeks agree — one week is noise.
 * Never applied without a tap.
 */
export function consistencySuggestion(
  thisWeek: number,
  previousWeek: number,
  target: number
): ConsistencySuggestion | null {
  if (thisWeek < target && previousWeek < target) {
    const to = Math.max(1, Math.max(thisWeek, previousWeek));
    return to < target ? { kind: 'lower', to } : null;
  }

  if (thisWeek > target && previousWeek > target) {
    const to = Math.min(7, target + 1);
    return to > target ? { kind: 'raise', to } : null;
  }

  return null;
}
