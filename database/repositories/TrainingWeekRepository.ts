import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type WeeklyReview from '@/database/models/WeeklyReview';
import {
  isDecisionLive,
  parseTrainingDecisionSnapshot,
  type TrainingDecisionSnapshot,
} from '@/utils/trainingWeekDecision';

export type ActiveTrainingWeek = {
  decision: 'repeat' | 'lighter';
  reviewId: string;
  snapshot: TrainingDecisionSnapshot;
};

/**
 * What the Weekly Review decided for the training week. A leaf module on purpose: both
 * `WeeklyReviewService` (which writes the decision) and `WorkoutProgressionService` (which obeys
 * it) need to read it, and the review service already imports the progression service.
 *
 * A decision that does not parse is no decision. It changes people's workouts, so there is no
 * best-effort repair of a snapshot we cannot trust.
 */
export class TrainingWeekRepository {
  /** Every review that chose a `repeat` or `lighter` week, with its parsed snapshot. */
  private static async overrides(): Promise<ActiveTrainingWeek[]> {
    const rows = await database
      .get<WeeklyReview>('weekly_reviews')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('training_decision', Q.oneOf(['repeat', 'lighter']))
      )
      .fetch();
    return rows.flatMap((row) => {
      const snapshot = parseTrainingDecisionSnapshot(row.trainingJson);
      return snapshot && (snapshot.decision === 'repeat' || snapshot.decision === 'lighter')
        ? [{ decision: snapshot.decision, reviewId: row.id, snapshot }]
        : [];
    });
  }

  /** The decision shaping workouts started at `at`, if any. The most recent one wins. */
  static async activeTrainingWeek(at: number = Date.now()): Promise<ActiveTrainingWeek | null> {
    const live = (await this.overrides()).filter((week) => isDecisionLive(week.snapshot, at));
    live.sort((a, b) => b.snapshot.window.from - a.snapshot.window.from);
    return live[0] ?? null;
  }

  /** Every lighter-week window, so history and goal projections can leave that training out. */
  static async lighterWeekWindows(): Promise<{ from: number; until: number }[]> {
    return (await this.overrides())
      .filter((week) => week.decision === 'lighter')
      .map((week) => week.snapshot.window);
  }
}
