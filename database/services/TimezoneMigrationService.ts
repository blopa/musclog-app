import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import ExerciseGoal from '@/database/models/ExerciseGoal';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import NutritionCheckin from '@/database/models/NutritionCheckin';
import NutritionGoal from '@/database/models/NutritionGoal';
import SavedForLaterGroup from '@/database/models/SavedForLaterGroup';
import { getCurrentTimezone } from '@/utils/timezone';

export class TimezoneMigrationService {
  /**
   * One-time backfill: ensure all rows in newly timezone-aware tables have a
   * timezone offset. Uses the current device timezone as a best-effort fallback.
   */
  static async backfillMissingTimezones(): Promise<void> {
    const [cycles, checkins, savedGroups, nutritionGoals, exerciseGoals] = await Promise.all([
      database
        .get<MenstrualCycle>('menstrual_cycles')
        .query(Q.where('timezone', Q.eq(null)))
        .fetch(),
      database
        .get<NutritionCheckin>('nutrition_checkins')
        .query(Q.where('timezone', Q.eq(null)))
        .fetch(),
      database
        .get<SavedForLaterGroup>('saved_for_later_groups')
        .query(Q.where('timezone', Q.eq(null)))
        .fetch(),
      database
        .get<NutritionGoal>('nutrition_goals')
        .query(Q.where('timezone', Q.eq(null)))
        .fetch(),
      database
        .get<ExerciseGoal>('exercise_goals')
        .query(Q.where('timezone', Q.eq(null)))
        .fetch(),
    ]);

    const total =
      cycles.length +
      checkins.length +
      savedGroups.length +
      nutritionGoals.length +
      exerciseGoals.length;
    if (total === 0) {
      return;
    }

    const fallback = getCurrentTimezone();
    const now = Date.now();

    await database.write(async () => {
      await database.batch(
        ...cycles.map((c) =>
          c.prepareUpdate((r) => {
            r.timezone = fallback;
            r.updatedAt = now;
          })
        ),
        ...checkins.map((c) =>
          c.prepareUpdate((r) => {
            r.timezone = fallback;
            r.updatedAt = now;
          })
        ),
        ...savedGroups.map((g) =>
          g.prepareUpdate((r) => {
            r.timezone = fallback;
            r.updatedAt = now;
          })
        ),
        ...nutritionGoals.map((g) =>
          g.prepareUpdate((r) => {
            r.timezone = fallback;
            r.updatedAt = now;
          })
        ),
        ...exerciseGoals.map((g) =>
          g.prepareUpdate((r) => {
            r.timezone = fallback;
            r.updatedAt = new Date(now);
          })
        )
      );
    });
  }
}
