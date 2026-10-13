import { type Model, Q } from '@nozbe/watermelondb';

import { commitPrepared } from '@/database/commitPrepared';
import { database } from '@/database/database-instance';
import type NutritionGoal from '@/database/models/NutritionGoal';
import type NutritionTargetPeriod from '@/database/models/NutritionTargetPeriod';
import type WeeklyReview from '@/database/models/WeeklyReview';
import type WorkoutLog from '@/database/models/WorkoutLog';
import { getNutritionDayCoverage } from '@/database/nutritionDayCoverage';
import { TrainingWeekRepository } from '@/database/repositories/TrainingWeekRepository';
import { WorkoutTodayRepository } from '@/database/repositories/WorkoutTodayRepository';
import {
  dayKeyRange,
  localDayKeyPlusCalendarDays,
  localDayStartMs,
  utcDayKeyFromLocalDate,
  utcNormalizedDayKey,
} from '@/utils/calendarDate';
import { resolveWeeklyRecommendation } from '@/utils/dynamicNutritionTarget';
import { parseSetPrescription } from '@/utils/setPrescription';
import {
  parseTrainingDecisionSnapshot,
  serializeTrainingDecisionSnapshot,
  TRAINING_DECISIONS,
  type TrainingDecision,
  type TrainingDecisionSnapshot,
} from '@/utils/trainingWeekDecision';
import {
  calculateTrendWeightSeries,
  TREND_WEIGHT_WARMUP_DAYS,
  trendWeightAtOrBefore,
} from '@/utils/trendWeight';
import { storedWeightToKg } from '@/utils/unitConversion';
import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';
import {
  consistencySuggestion,
  goalVerdicts,
  recommendTrainingWeek,
} from '@/utils/weeklyTrainingRecommendation';
import { widgetEvents } from '@/utils/widgetEvents';
import { isPerformedWorkoutSet, isWarmupSet } from '@/utils/workoutSetCompletion';

import { ExerciseGoalService } from './ExerciseGoalService';
import { NutritionGoalService } from './NutritionGoalService';
import { NutritionService } from './NutritionService';
import {
  nutritionTargetMode,
  type NutritionTargets,
  NutritionTargetService,
} from './NutritionTargetService';
import { SettingsService } from './SettingsService';
import { UserMetricService } from './UserMetricService';
import { WorkoutAnalytics } from './WorkoutAnalytics';
import { WorkoutProgressionService } from './WorkoutProgressionService';
import { WorkoutService } from './WorkoutService';

export type WeeklyNutritionRecommendation = {
  targets: NutritionTargets;
  usedEmpiricalData: boolean;
  foodDays: number;
  weightDays: number;
  canApply: boolean;
  /**
   * The daily expenditure the recommendation was built on, and how far trend weight moved over the
   * reviewed week (kg). They let the screen say WHY the targets changed instead of a generic line.
   * Optional because snapshots saved before they existed still have to load.
   */
  expenditure?: number;
  trendChangeKg?: number;
  /**
   * The user's minimum-calorie floor and whether they turned it off in Advanced settings, so the
   * review can warn when a recommendation goes below it. Optional for older snapshots.
   */
  minimumCalories?: number;
  minimumCaloriesDisabled?: boolean;
};

/**
 * Days of the reviewed week that must have logged food (or, with the fasting-day feature on, be
 * flagged as a fast) before its recommendation can be applied. The recommendation itself is built
 * from the 30-day history, so this only asks whether the week is representative: requiring all
 * seven let one forgotten day block the whole week.
 */
export const MIN_WEEKLY_FOOD_DAYS = 5;

/**
 * Days of the reviewed week with a weigh-in before its recommendation can be applied. The weekly
 * trend moves a target, and two noisy readings (water, sodium, a full gut) can fake a gain or a
 * loss large enough to swing calories — three days give the smoothed trend something to average.
 * Stricter than the 30-day history's own `MIN_WEIGHT_ENTRIES`, which only needs two points to fit.
 */
export const MIN_WEEKLY_WEIGHT_ENTRIES = 3;

/**
 * The days of a reviewed week the user could still fill in, as local midnights, so the review can
 * open the diary or the weight entry ON one of them. Logging today never counts toward a week that
 * has already closed, which is why "Log food" used to be a dead end.
 */
export type WeeklyEvidenceGaps = {
  /** The earliest day with neither food nor a flagged fast, when the week is short of food days. */
  foodDay: number | null;
  /** The latest day with no weigh-in, when the week is short of weigh-ins. */
  weightDay: number | null;
};

/**
 * When the training half of a period was acknowledged. Training is acknowledged once per period,
 * while nutrition decisions are recorded per goal — so the stamp is read from whichever of the
 * period's rows carries it, rather than from the row of the goal being looked at.
 */
const trainingReviewedAtFor = (reviews: readonly WeeklyReview[], periodEnd: number) =>
  reviews.find((row) => row.periodEnd === periodEnd && row.trainingReviewedAt)?.trainingReviewedAt;

/**
 * Weeks with a training decision since the last lighter week (all of them if there never was
 * one): the "you are due" signal. Newest first in, one count per reviewed period.
 */
const decidedWeeksSinceLighter = (reviews: readonly WeeklyReview[]): number => {
  const seen = new Set<number>();
  for (const row of reviews) {
    if (!row.trainingDecision || seen.has(row.periodEnd)) {
      continue;
    }

    if (row.trainingDecision === 'lighter') {
      break;
    }

    seen.add(row.periodEnd);
  }

  return seen.size;
};

/**
 * What the reviewed week holds, counted from the records themselves rather than the account's age
 * (restores and imports rewrite that), plus whether the user has EVER logged a workout or a meal —
 * which is what tells a first week apart from a week off.
 */
export type WeeklyActivity = {
  workouts: number;
  foodLogs: number;
  weighIns: number;
  everWorkout: boolean;
  everFood: boolean;
};

export class WeeklyReviewService {
  /** The week's activity, [start, end). One definition shared by the overview and the status badge. */
  static async weekActivity(start: number, end: number): Promise<WeeklyActivity> {
    const [workouts, foodLogs, weighIns, everWorkout, everFood] = await Promise.all([
      database
        .get('workout_logs')
        .query(
          Q.where('completed_at', Q.gte(start)),
          Q.where('completed_at', Q.lt(end)),
          Q.where('deleted_at', Q.eq(null))
        )
        .fetchCount(),
      database
        .get('nutrition_logs')
        .query(
          Q.where('date', Q.gte(start)),
          Q.where('date', Q.lt(end)),
          Q.where('deleted_at', Q.eq(null))
        )
        .fetchCount(),
      database
        .get('user_metrics')
        .query(
          Q.where('type', 'weight'),
          Q.where('date', Q.gte(start)),
          Q.where('date', Q.lt(end)),
          Q.where('deleted_at', Q.eq(null))
        )
        .fetchCount(),
      database
        .get('workout_logs')
        .query(Q.where('completed_at', Q.notEq(null)), Q.where('deleted_at', Q.eq(null)), Q.take(1))
        .fetchCount(),
      database
        .get('nutrition_logs')
        .query(Q.where('deleted_at', Q.eq(null)), Q.take(1))
        .fetchCount(),
    ]);
    return {
      workouts,
      foodLogs,
      weighIns,
      everWorkout: everWorkout > 0,
      everFood: everFood > 0,
    };
  }

  static history(): Promise<WeeklyReview[]> {
    return database
      .get<WeeklyReview>('weekly_reviews')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('period_end', Q.desc))
      .fetch();
  }
  static async overview(reviewId?: string, reviewDay?: Date) {
    const weekday = await SettingsService.getReviewWeekday();
    const saved = reviewId
      ? await database.get<WeeklyReview>('weekly_reviews').find(reviewId)
      : undefined;
    const period = saved
      ? {
          start: saved.periodStart,
          end: saved.periodEnd,
          next: localDayKeyPlusCalendarDays(saved.periodEnd, 7),
          timezone: saved.timezone,
        }
      : weeklyReviewPeriod(reviewDay ?? new Date(), weekday);
    const goal = saved
      ? saved.nutritionGoalId
        ? await database
            .get<NutritionGoal>('nutrition_goals')
            .find(saved.nutritionGoalId)
            .catch(() => null)
        : null
      : await NutritionGoalService.getCurrent();
    const [reviews, intuitive, workouts, upcoming, activity] = await Promise.all([
      this.history(),
      SettingsService.getIntuitiveEatingMode(),
      database
        .get<WorkoutLog>('workout_logs')
        .query(
          Q.where('completed_at', Q.gte(period.start)),
          Q.where('completed_at', Q.lt(period.end)),
          Q.where('deleted_at', Q.eq(null))
        )
        .fetch(),
      WorkoutTodayRepository.upcoming(),
      this.weekActivity(period.start, period.end),
    ]);
    const review =
      saved ??
      reviews.find(
        (row) =>
          row.periodEnd === period.end && (row.nutritionGoalId ?? null) === (goal?.id ?? null)
      ) ??
      null;
    const details = await Promise.all(
      workouts.map((workout) => WorkoutService.getWorkoutWithDetails(workout.id))
    );
    const workingSets = details
      .flatMap((detail) => detail.sets)
      .filter((set) => isPerformedWorkoutSet(set) && !isWarmupSet(set));
    const records = (
      await Promise.all(workouts.map((workout) => WorkoutAnalytics.detectPersonalRecords(workout)))
    ).flat();
    // A user who has never finished a workout is not asked a training question.
    const hasTrainedBefore = activity.everWorkout;
    const next = upcoming.find((row) => !row.completedToday);
    // Training is decided once per period while nutrition is decided per goal, so the decision is
    // read from whichever of the period's rows carries it (see `trainingReviewedAtFor`).
    const trainingRow = reviews.find((row) => row.periodEnd === period.end && row.trainingDecision);
    const trainingDecision = trainingRow
      ? parseTrainingDecisionSnapshot(trainingRow.trainingJson)
      : null;
    const trainingEvidence = await this.trainingEvidence({
      period,
      workouts,
      details,
      workingSets,
      activity,
      reviews,
    });
    // Once a repeat or lighter week is chosen, the session will not follow the plain progression
    // these targets project, so showing them would promise numbers the session never uses.
    const targets =
      next && (trainingDecision?.decision ?? 'progress') === 'progress'
        ? await WorkoutProgressionService.projectTemplate(next.template.id)
        : [];
    const current = goal
      ? await NutritionTargetService.resolve(goal, saved ? new Date(saved.periodEnd) : new Date())
      : null;
    const { nutrition, trendWeight, gaps } =
      goal && !intuitive
        ? await this.nutritionEvidence(goal, period, review)
        : { nutrition: null, trendWeight: null, gaps: { foodDay: null, weightDay: null } };
    let accepted: NutritionTargets | null = null;
    if (review?.acceptedJson) {
      try {
        const snapshot = JSON.parse(review.acceptedJson) as NutritionTargets;
        NutritionTargetService.validateTargets(snapshot);
        accepted = snapshot;
      } catch {
        // Older invalid snapshots cannot become target values.
      }
    }

    return {
      period,
      /** Past its next-review date: it can still be acknowledged but no longer approved. */
      periodEnded: Date.now() >= period.next,
      weekday,
      review,
      reviews,
      goal,
      current,
      nutrition,
      gaps,
      accepted,
      trendWeight,
      intuitive,
      activity,
      training: {
        reviewedAt: trainingReviewedAtFor(reviews, period.end),
        workouts,
        workingSets: workingSets.length,
        volume: workouts.reduce((sum, workout) => sum + (workout.totalVolume ?? 0), 0),
        records,
        targets,
        next,
        decision: trainingDecision,
        proposal: trainingEvidence.proposal,
        consistencySuggestion: trainingEvidence.suggestion,
        // Only the latest review can still shape a week, and only until the next review is due.
        canDecide:
          !saved &&
          trainingReviewedAtFor(reviews, period.end) == null &&
          Date.now() < period.next &&
          hasTrainedBefore,
      },
      ready:
        (hasTrainedBefore && trainingReviewedAtFor(reviews, period.end) == null) ||
        (!!goal && !intuitive && !review?.nutritionReviewedAt),
    };
  }

  /**
   * What the training half judges the week on, and what it proposes for the next one: each active
   * fitness goal against the reviewed week, then `recommendTrainingWeek` over the lot. The 1RM
   * projections leave lighter weeks out — deliberately light training would read as "declining".
   */
  private static async trainingEvidence(input: {
    period: ReturnType<typeof weeklyReviewPeriod>;
    workouts: WorkoutLog[];
    details: Awaited<ReturnType<typeof WorkoutService.getWorkoutWithDetails>>[];
    workingSets: { repsInReserve: number; rirRecorded?: boolean }[];
    activity: WeeklyActivity;
    reviews: readonly WeeklyReview[];
  }): Promise<{
    proposal: Pick<TrainingDecisionSnapshot, 'recommended' | 'reasons' | 'goals'>;
    suggestion: ReturnType<typeof consistencySuggestion>;
  }> {
    const { period, workouts, details, workingSets, activity, reviews } = input;
    const [goals, windows, previousWeek] = await Promise.all([
      ExerciseGoalService.getActiveGoals(),
      TrainingWeekRepository.lighterWeekWindows(),
      this.weekActivity(localDayKeyPlusCalendarDays(period.start, -7), period.start),
    ]);
    const consistencyGoal = goals.find(
      (goal) => goal.goalType === 'consistency' && goal.targetSessionsPerWeek != null
    );
    const oneRm = await Promise.all(
      goals
        .filter((goal) => goal.goalType === '1rm' && goal.exerciseId)
        .map(async (goal) => ({
          goalId: goal.id,
          exerciseId: goal.exerciseId!,
          exerciseName: goal.exerciseNameSnapshot ?? '',
          targetDate: goal.targetDate,
          projection: await ExerciseGoalService.evaluate1rmGoal(goal, {
            excludeWindows: windows,
          }).catch(() => null),
        }))
    );
    const verdicts = goalVerdicts({
      workoutsThisWeek: workouts.length,
      consistency: consistencyGoal
        ? { goalId: consistencyGoal.id, target: consistencyGoal.targetSessionsPerWeek! }
        : null,
      oneRm,
    });
    // Exercises the automatic path deloaded on its own this week. A deload the REVIEW chose does
    // not count: it would recommend a lighter week for having had one.
    const deloaded = new Set<string>();
    for (const detail of details) {
      for (const set of detail.sets) {
        const explanation = parseSetPrescription(set.prescriptionJson)?.explanation;
        if (explanation?.cause === 'deload' && explanation.source !== 'weekly_review') {
          deloaded.add(set.exerciseId);
        }
      }
    }

    const rated = workingSets.filter((set) => set.rirRecorded);
    const { decision, reasons } = recommendTrainingWeek({
      workoutsThisWeek: workouts.length,
      everWorkout: activity.everWorkout,
      deloadedExercises: deloaded.size,
      ratedSets: rated.length,
      averageRir: rated.length
        ? rated.reduce((sum, set) => sum + set.repsInReserve, 0) / rated.length
        : null,
      goals: verdicts,
      decidedWeeksSinceLighter: decidedWeeksSinceLighter(reviews),
    });
    return {
      proposal: { recommended: decision, reasons, goals: verdicts },
      suggestion: consistencyGoal
        ? consistencySuggestion(
            workouts.length,
            previousWeek.workouts,
            consistencyGoal.targetSessionsPerWeek!
          )
        : null,
    };
  }

  /**
   * The nutrition half of the overview: the week's trend weight, how much of it is logged, which
   * days are still missing, and the recommendation (a stored snapshot wins once the review is
   * decided). Needs a goal, so the caller skips it for intuitive eating.
   */
  private static async nutritionEvidence(
    goal: NutritionGoal,
    period: ReturnType<typeof weeklyReviewPeriod>,
    review: WeeklyReview | null
  ): Promise<{
    nutrition: WeeklyNutritionRecommendation | null;
    trendWeight: number | null;
    gaps: WeeklyEvidenceGaps;
  }> {
    let nutrition: WeeklyNutritionRecommendation | null = null;
    let trendWeight: number | null = null;
    let gaps: WeeklyEvidenceGaps = { foodDay: null, weightDay: null };
    const lastDay = new Date(localDayKeyPlusCalendarDays(period.end, -1));
    const [logs, weights, proposed] = await Promise.all([
      NutritionService.getNutritionLogsForDateRange(new Date(period.start), lastDay),
      UserMetricService.getMetricsHistory('weight', {
        startDate: localDayKeyPlusCalendarDays(period.start, -TREND_WEIGHT_WARMUP_DAYS),
        endDate: period.end - 1,
      }),
      resolveWeeklyRecommendation(goal, lastDay),
    ]);
    const startKey = utcDayKeyFromLocalDate(new Date(period.start));
    const endKey = utcDayKeyFromLocalDate(new Date(period.end));
    const points = await Promise.all(
      weights.map(async (weight) => {
        const data = await weight.getDecrypted();
        return {
          date: utcNormalizedDayKey(weight.date, weight.timezone),
          value: storedWeightToKg(data.value, data.unit),
        };
      })
    );
    const weightDayKeys = new Set(
      points
        .filter((point) => point.date >= startKey && point.date < endKey)
        .map((point) => point.date)
    );
    const weightDays = weightDayKeys.size;
    // A flagged fast is a real 0-kcal day, exactly as every other average treats it.
    const { effectiveDayKeys: foodDayKeys } = await getNutritionDayCoverage(logs, {
      range: dayKeyRange(startKey, utcDayKeyFromLocalDate(lastDay)),
    });
    const foodDays = foodDayKeys.size;
    const days = Array.from({ length: 7 }, (_, offset) =>
      localDayKeyPlusCalendarDays(period.start, offset)
    ).filter((day) => day < period.end);
    const keyOf = (day: number) => utcDayKeyFromLocalDate(new Date(day));
    gaps = {
      foodDay:
        foodDays < MIN_WEEKLY_FOOD_DAYS
          ? (days.find((day) => !foodDayKeys.has(keyOf(day))) ?? null)
          : null,
      weightDay:
        weightDays < MIN_WEEKLY_WEIGHT_ENTRIES
          ? ([...days].reverse().find((day) => !weightDayKeys.has(keyOf(day))) ?? null)
          : null,
    };
    const series = calculateTrendWeightSeries(points);
    trendWeight = trendWeightAtOrBefore(series, utcDayKeyFromLocalDate(lastDay))?.value ?? null;
    const weekStartTrend = trendWeightAtOrBefore(series, startKey - 1)?.value ?? null;
    if (proposed) {
      nutrition = {
        targets: proposed,
        usedEmpiricalData: proposed.usedEmpiricalData,
        expenditure: proposed.tdee,
        trendChangeKg:
          trendWeight != null && weekStartTrend != null ? trendWeight - weekStartTrend : undefined,
        foodDays,
        weightDays,
        minimumCalories: proposed.minimumCalories,
        minimumCaloriesDisabled: proposed.minimumCaloriesDisabled,
        canApply:
          foodDays >= MIN_WEEKLY_FOOD_DAYS &&
          weightDays >= MIN_WEEKLY_WEIGHT_ENTRIES &&
          trendWeight != null,
      };
    }

    if (review?.recommendationJson) {
      try {
        const snapshot = JSON.parse(review.recommendationJson) as WeeklyNutritionRecommendation;
        NutritionTargetService.validateTargets(snapshot.targets);
        if (
          typeof snapshot.canApply === 'boolean' &&
          typeof snapshot.usedEmpiricalData === 'boolean' &&
          Number.isFinite(snapshot.foodDays) &&
          Number.isFinite(snapshot.weightDays)
        ) {
          nutrition = snapshot;
        }
      } catch {
        /* Older invalid snapshots remain visible in history without being applied. */
      }
    }

    return { nutrition, trendWeight, gaps };
  }

  static async decide(input: {
    period: ReturnType<typeof weeklyReviewPeriod>;
    goalId?: string;
    section: 'training' | 'nutrition';
    decision?: 'apply' | 'keep';
    /** The training half's choice, with the evidence the review showed when it was made. */
    training?: {
      decision: TrainingDecision;
    } & Pick<TrainingDecisionSnapshot, 'recommended' | 'reasons' | 'goals'>;
    recommendation?: WeeklyNutritionRecommendation;
    accepted?: NutritionTargets;
  }): Promise<string> {
    if (input.section === 'nutrition' && (!input.goalId || !input.decision)) {
      throw new Error('A nutrition decision requires a goal');
    }

    if (
      input.section === 'training' &&
      (!input.training || !TRAINING_DECISIONS.includes(input.training.decision))
    ) {
      throw new Error('A training decision is required');
    }

    // A review shapes the days until the next one is due. Once that has passed, training decisions
    // and approved targets would describe a week that is no longer the one being lived, so both are
    // refused; acknowledging ("keep") a past nutrition review changes nothing and stays possible.
    if (
      (input.section === 'training' || input.decision === 'apply') &&
      Date.now() >= input.period.next
    ) {
      throw new Error('This review has ended; refresh the review');
    }

    if (input.decision === 'apply' && (!input.recommendation?.canApply || !input.accepted)) {
      throw new Error('More logged data is required');
    }

    if (input.accepted) {
      NutritionTargetService.validateTargets(input.accepted);
    }

    const id = await database.write(async () => {
      const reviews = await this.history();
      const existing = reviews.find(
        (row) =>
          row.periodEnd === input.period.end &&
          (row.nutritionGoalId ?? null) === (input.goalId ?? null)
      );
      if (
        input.section === 'training' ? existing?.trainingReviewedAt : existing?.nutritionReviewedAt
      ) {
        return existing!.id;
      }

      const goal =
        input.section === 'nutrition'
          ? await database.get<NutritionGoal>('nutrition_goals').find(input.goalId!)
          : null;
      if (goal && (goal.deletedAt || goal.effectiveUntil != null)) {
        throw new Error('Goal has changed; refresh the review');
      }

      if (input.decision === 'apply' && goal && nutritionTargetMode(goal) !== 'weekly') {
        throw new Error('Switch to weekly targets before applying');
      }

      const from = localDayKeyPlusCalendarDays(localDayStartMs(new Date()), 1);
      const periods =
        input.decision === 'apply' && goal
          ? await database
              .get<NutritionTargetPeriod>('nutrition_target_periods')
              .query(Q.where('nutrition_goal_id', goal.id), Q.where('deleted_at', Q.eq(null)))
              .fetch()
          : [];
      const now = Date.now();
      const populate = (record: WeeklyReview) => {
        if (!existing) {
          record.trainingReviewedAt = trainingReviewedAtFor(reviews, input.period.end);
        }

        record.periodStart = input.period.start;
        record.periodEnd = input.period.end;
        record.timezone = input.period.timezone;
        record.nutritionGoalId = input.goalId;
        if (input.section === 'training') {
          record.trainingReviewedAt = now;
          record.trainingDecision = input.training!.decision;
          record.trainingJson = serializeTrainingDecisionSnapshot({
            ...input.training!,
            // The decision shapes workouts from now until the next review is due.
            window: { from: now, until: input.period.next },
          });
        } else {
          record.nutritionReviewedAt = now;
          record.nutritionDecision = input.decision;
          record.recommendationJson = input.recommendation
            ? JSON.stringify(input.recommendation)
            : undefined;
          record.acceptedJson = input.accepted ? JSON.stringify(input.accepted) : undefined;
        }

        record.updatedAt = now;
        if (!existing) {
          record.createdAt = now;
        }
      };

      let reviewId = '';
      await commitPrepared(database, [...(existing ? [existing] : []), ...periods], () => {
        const review = existing
          ? existing.prepareUpdate(populate)
          : database.get<WeeklyReview>('weekly_reviews').prepareCreate(populate);
        const operations: Model[] = [review];
        if (input.decision === 'apply' && goal) {
          operations.push(
            ...periods
              .filter((row) => row.effectiveUntil == null || row.effectiveUntil > from)
              .map((row) =>
                row.prepareUpdate((record) => {
                  record.effectiveUntil = Math.max(from, record.effectiveFrom);
                  record.updatedAt = now;
                })
              ),
            NutritionTargetService.preparePeriod(goal.id, input.accepted!, from, now, review.id)
          );
        }

        reviewId = review.id;
        return operations;
      });
      return reviewId;
    });
    widgetEvents.emitNutritionWidgetUpdate();
    return id;
  }
}
