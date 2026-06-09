import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import ExerciseGoal from '@/database/models/ExerciseGoal';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import NutritionCheckin from '@/database/models/NutritionCheckin';
import NutritionGoal from '@/database/models/NutritionGoal';
import SavedForLaterGroup from '@/database/models/SavedForLaterGroup';
import { isTimezoneOffset } from '@/utils/timezone';
import { getCurrentTimezone } from '@/utils/timezone';

export class TimezoneMigrationService {
  /**
   * One-time backfill: ensure all rows in newly timezone-aware tables have a
   * timezone offset. Uses the current device timezone as a best-effort fallback.
   */
  static async backfillMissingTimezones(): Promise<void> {
    const fallback = getCurrentTimezone();
    const now = Date.now();

    await database.write(async () => {
      // 1. Menstrual Cycles
      const cycles = await database
        .get<MenstrualCycle>('menstrual_cycles')
        .query(Q.where('timezone', Q.eq(null)))
        .fetch();

      // 2. Nutrition Checkins
      const checkins = await database
        .get<NutritionCheckin>('nutrition_checkins')
        .query(Q.where('timezone', Q.eq(null)))
        .fetch();

      // 3. Saved For Later Groups
      const savedGroups = await database
        .get<SavedForLaterGroup>('saved_for_later_groups')
        .query(Q.where('timezone', Q.eq(null)))
        .fetch();

      // 4. Nutrition Goals
      const nutritionGoals = await database
        .get<NutritionGoal>('nutrition_goals')
        .query(Q.where('timezone', Q.eq(null)))
        .fetch();

      // 5. Exercise Goals
      const exerciseGoals = await database
        .get<ExerciseGoal>('exercise_goals')
        .query(Q.where('timezone', Q.eq(null)))
        .fetch();

      const batches = [
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
        ),
      ];

      if (batches.length > 0) {
        await database.batch(...batches);
      }
    });
  }
}
