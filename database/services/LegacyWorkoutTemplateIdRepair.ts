import { Q } from '@nozbe/watermelondb';

import { commitPrepared } from '@/database/commitPrepared';
import { database } from '@/database/database-instance';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutTemplate from '@/database/models/WorkoutTemplate';
import { chunked, MAX_BATCH_OPERATIONS } from '@/database/queryByIds';

/**
 * Logs converted from Musclog 1.x before `MigrationService` mapped workout ids hold the old numeric
 * 1.x workout id ("8") as `template_id`, which no template has, so a workout's own sessions could
 * not be found by id. This points each such log at the template it became, once, so every reader
 * can use a plain `template_id` match instead of each carrying a name-matching workaround.
 *
 * A log is an orphan when its `template_id` names no template at all (a deleted template still
 * exists as a row, so its logs are not orphans). It is repaired only when exactly one live
 * template carries its workout name: with several, there is no telling which the log belonged to,
 * and leaving it alone beats attaching it to the wrong workout.
 */
export class LegacyWorkoutTemplateIdRepair {
  static async run(): Promise<number> {
    return database.write(async () => {
      const templates = await database.get<WorkoutTemplate>('workout_templates').query().fetch();
      const knownIds = new Set(templates.map((template) => template.id));
      const liveIdsByName = new Map<string, string[]>();
      for (const template of templates.filter((t) => t.deletedAt == null && t.name)) {
        liveIdsByName.set(template.name, [
          ...(liveIdsByName.get(template.name) ?? []),
          template.id,
        ]);
      }

      const logs = await database
        .get<WorkoutLog>('workout_logs')
        .query(
          Q.where('deleted_at', Q.eq(null)),
          Q.where('template_id', Q.notEq(null)),
          Q.where('template_id', Q.notEq(''))
        )
        .fetch();

      const repairs = new Map<WorkoutLog, string>();
      for (const log of logs) {
        const candidates = liveIdsByName.get(log.workoutName ?? '');
        if (!knownIds.has(log.templateId!) && candidates?.length === 1) {
          repairs.set(log, candidates[0]);
        }
      }

      for (const chunk of chunked([...repairs.keys()], MAX_BATCH_OPERATIONS)) {
        await commitPrepared(database, chunk, () =>
          chunk.map((log) =>
            log.prepareUpdate((record) => {
              record.templateId = repairs.get(log);
            })
          )
        );
      }

      return repairs.size;
    });
  }
}
