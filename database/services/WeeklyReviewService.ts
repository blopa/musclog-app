import { type Model, Q } from '@nozbe/watermelondb';

import { commitPrepared } from '@/database/commitPrepared';
import { database } from '@/database/database-instance';
import type NutritionGoal from '@/database/models/NutritionGoal';
import type NutritionTargetPeriod from '@/database/models/NutritionTargetPeriod';
import type WeeklyReview from '@/database/models/WeeklyReview';
import type WorkoutLog from '@/database/models/WorkoutLog';
import { getNutritionDayCoverage } from '@/database/nutritionDayCoverage';
import { WorkoutTodayRepository } from '@/database/repositories/WorkoutTodayRepository';
import {
  dayKeyRange,
  localDayKeyPlusCalendarDays,
  localDayStartMs,
  utcDayKeyFromLocalDate,
  utcNormalizedDayKey,
} from '@/utils/calendarDate';
import { resolveWeeklyRecommendation } from '@/utils/dynamicNutritionTarget';
import {
  calculateTrendWeightSeries,
  TREND_WEIGHT_WARMUP_DAYS,
  trendWeightAtOrBefore,
} from '@/utils/trendWeight';
import { storedWeightToKg } from '@/utils/unitConversion';
import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';
import { widgetEvents } from '@/utils/widgetEvents';
import { isPerformedWorkoutSet, isWarmupSet } from '@/utils/workoutSetCompletion';

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

export class WeeklyReviewService {
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
    const [reviews, intuitive, workouts, upcoming] = await Promise.all([
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
    const next = upcoming.find((row) => !row.completedToday);
    const targets = next ? await WorkoutProgressionService.projectTemplate(next.template.id) : [];
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
      training: {
        reviewedAt: trainingReviewedAtFor(reviews, period.end),
        workouts,
        workingSets: workingSets.length,
        volume: workouts.reduce((sum, workout) => sum + (workout.totalVolume ?? 0), 0),
        records,
        targets,
        next,
      },
      ready:
        trainingReviewedAtFor(reviews, period.end) == null ||
        (!!goal && !intuitive && !review?.nutritionReviewedAt),
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
    recommendation?: WeeklyNutritionRecommendation;
    accepted?: NutritionTargets;
  }): Promise<string> {
    if (input.section === 'nutrition' && (!input.goalId || !input.decision)) {
      throw new Error('A nutrition decision requires a goal');
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
