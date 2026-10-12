import { type Model, Q } from '@nozbe/watermelondb';

import { commitPrepared } from '@/database/commitPrepared';
import { database } from '@/database/database-instance';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import type WorkoutTemplateExercise from '@/database/models/WorkoutTemplateExercise';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import { fetchByIds, MAX_BATCH_OPERATIONS } from '@/database/queryByIds';
import type { SubstitutionReason } from '@/utils/exerciseSubstitution';
import { normalizeNote } from '@/utils/noteText';
import { parseSetPrescription, serializeSetPrescription } from '@/utils/setPrescription';
import { isPlannedWorkoutSet, isWarmupSet, WARMUP_SET_TYPE } from '@/utils/workoutSetCompletion';

/**
 * Edits to ONE exercise block of a running or finished session — what it is (a swap), what was
 * said about it (a note) and how it is warmed up for. Each is a single writer; none touches the
 * template the session came from unless the call says so.
 */
export class WorkoutLogExerciseService {
  /**
   * Swap the exercise of one block in a session. Only the LOG changes — the template or plan the
   * session came from is never touched, which is what makes "just today" safe.
   *
   * The block remembers what it replaced and why (`replaced_exercise_id`, `substitution_reason`).
   * When a block is swapped twice, `replaced_exercise_id` keeps the ORIGINAL exercise, since that
   * is what the plan called for. Sets already performed or skipped keep their original block and movement identity.
   * A swap after logging splits off a new block for pending sets, in the same batch. Sets still planned get `plannedWeightKg` instead of the old exercise's load: a planned
   * 80 kg bench is not an 80 kg dumbbell fly.
   */
  static async replaceLogExercise(
    logExerciseId: string,
    newExerciseId: string,
    options: { reason: SubstitutionReason; plannedWeightKg?: number }
  ): Promise<string> {
    return database.write(async () => {
      const collection = database.get<WorkoutLogExercise>('workout_log_exercises');
      const original = await collection.find(logExerciseId);
      if (original.exerciseId === newExerciseId) {
        return original.id;
      }
      const sets = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(Q.where('log_exercise_id', logExerciseId), Q.where('deleted_at', Q.eq(null)))
        .fetch();
      const planned = sets.filter(isPlannedWorkoutSet);
      const hasHistory = sets.some((set) => !isPlannedWorkoutSet(set));
      if (hasHistory && !planned.length) {
        return original.id;
      }
      const siblings = hasHistory
        ? await collection
            .query(
              Q.where('workout_log_id', original.workoutLogId),
              Q.where('deleted_at', Q.eq(null)),
              Q.where('exercise_order', Q.gt(original.exerciseOrder))
            )
            .fetch()
        : [];
      const now = Date.now();
      let replacementId = original.id;
      await commitPrepared(database, [original, ...sets, ...siblings], () => {
        const operations: Model[] = [];
        const replace = (record: WorkoutLogExercise) => {
          record.exerciseId = newExerciseId;
          record.replacedExerciseId = original.replacedExerciseId ?? original.exerciseId;
          record.substitutionReason = options.reason;
          record.progressionJson = undefined;
          record.updatedAt = now;
        };
        if (hasHistory) {
          const workingSetCount = sets.filter((set) => !isWarmupSet(set)).length;
          for (const set of sets.filter((row) => !isPlannedWorkoutSet(row) && !isWarmupSet(row))) {
            const prescription = parseSetPrescription(set.prescriptionJson);
            if ((prescription?.workingSetCount ?? 0) >= workingSetCount) {
              continue;
            }
            operations.push(
              set.prepareUpdate((record) => {
                record.prescriptionJson = serializeSetPrescription({
                  ...(prescription ?? {
                    established: true,
                    plan: { weightKg: set.weight, reps: set.reps },
                    recommendation: { weightKg: set.weight, reps: set.reps },
                  }),
                  workingSetCount,
                });
                record.updatedAt = now;
              })
            );
          }
          const replacement = collection.prepareCreate((record) => {
            record.workoutLogId = original.workoutLogId;
            record.templateExerciseId = original.templateExerciseId;
            record.exerciseOrder = original.exerciseOrder + 1;
            record.groupId = original.groupId;
            record.supersetSlotId = original.supersetSlotId ?? original.id;
            record.notes = original.notes;
            record.createdAt = now;
            replace(record);
          });
          replacementId = replacement.id;
          operations.push(
            replacement,
            ...siblings.map((row) =>
              row.prepareUpdate((record) => {
                record.exerciseOrder = row.exerciseOrder + 1;
                record.updatedAt = now;
              })
            )
          );
        } else {
          // Capture the original ID before prepareUpdate mutates the cached model.
          const replacedId = original.replacedExerciseId ?? original.exerciseId;
          operations.push(
            original.prepareUpdate((record) => {
              replace(record);
              record.replacedExerciseId = replacedId;
            })
          );
        }
        operations.push(
          ...planned.map((set) =>
            set.prepareUpdate((record) => {
              record.logExerciseId = replacementId;
              if (options.plannedWeightKg !== undefined) {
                record.weight = Math.max(0, options.plannedWeightKg);
              }
              record.prescriptionJson = undefined;
              record.adjustmentJson = undefined;
              record.updatedAt = now;
            })
          )
        );
        return operations;
      });
      return replacementId;
    });
  }

  /**
   * Saves the note on an exercise of a running or finished session. With `alsoSaveToTemplate` the
   * template exercise this block was copied from takes the same note, so the next time the workout
   * is started it is already there. Both writes are one batch: a note that reaches the log but not
   * the template (or the reverse) would leave the two disagreeing about what was said.
   *
   * Reports whether the template was updated — it is not when the block was added mid-session, the
   * workout has no template, or the template exercise has since been deleted.
   */
  static async saveLogExerciseNote(
    logExerciseId: string,
    note: string | null,
    options: { alsoSaveToTemplate?: boolean } = {}
  ): Promise<{ savedToTemplate: boolean }> {
    return await database.write(async () => {
      const logExercise = await database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .find(logExerciseId);
      const normalized = normalizeNote(note);
      const now = Date.now();

      let templateExercise: WorkoutTemplateExercise | null = null;
      if (options.alsoSaveToTemplate && logExercise.templateExerciseId) {
        const found = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .find(logExercise.templateExerciseId)
          .catch(() => null);
        templateExercise = found && !found.deletedAt ? found : null;
      }

      await database.batch(
        logExercise.prepareUpdate((record) => {
          record.notes = normalized;
          record.updatedAt = now;
        }),
        ...(templateExercise
          ? [
              templateExercise.prepareUpdate((record) => {
                record.notes = normalized;
                record.updatedAt = now;
              }),
            ]
          : [])
      );

      return { savedToTemplate: templateExercise !== null };
    });
  }

  /**
   * Inserts planned warm-up sets in front of an exercise's first working set.
   *
   * `set_order` is one ordering key for the WHOLE workout, so making room means shifting every set
   * from the anchor onwards, not just this exercise's — all in one batch, so the session can never
   * be observed with two sets sharing an order. Returns how many sets were added; 0 when there is
   * nothing to warm up for (no planned working set left) or the exercise already has warm-ups, so a
   * second tap cannot stack another ramp on the first.
   */
  static async addWarmupSets(
    logExerciseId: string,
    warmups: readonly { weightKg: number; reps: number }[],
    options: { restTimeAfter?: number } = {}
  ): Promise<number> {
    if (warmups.length === 0) {
      return 0;
    }

    return await database.write(async () => {
      const logExercise = await database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .find(logExerciseId);
      const siblingExercises = await database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .query(
          Q.where('workout_log_id', logExercise.workoutLogId),
          Q.where('deleted_at', Q.eq(null))
        )
        .fetch();
      const siblingIds = siblingExercises.map((exercise) => exercise.id);
      const allSets = await fetchByIds<WorkoutLogSet>(
        'workout_log_sets',
        'log_exercise_id',
        siblingIds,
        Q.where('deleted_at', Q.eq(null))
      );

      const own = allSets.filter((set) => set.logExerciseId === logExerciseId);
      if (own.some(isWarmupSet)) {
        return 0;
      }
      const anchor = own
        .filter((set) => isPlannedWorkoutSet(set) && !isWarmupSet(set))
        .sort((a, b) => a.setOrder - b.setOrder)[0];
      if (!anchor) {
        return 0;
      }

      const now = Date.now();
      const count = warmups.length;
      // `prepareUpdate` applies its change to the record immediately, so the anchor's own order is
      // already shifted by the time the warm-ups are placed — read it once, before building anything.
      const anchorOrder = anchor.setOrder;
      const anchorRestTimeAfter = anchor.restTimeAfter;
      const collection = database.get<WorkoutLogSet>('workout_log_sets');
      const operations: Model[] = [
        // Make room: everything at or after the anchor moves down by the number of warm-ups.
        ...allSets
          .filter((set) => set.setOrder >= anchorOrder)
          .map((set) =>
            set.prepareUpdate((record) => {
              record.setOrder = set.setOrder + count;
              record.updatedAt = now;
            })
          ),
        ...warmups.map((warmup, index) =>
          collection.prepareCreate((record) => {
            record.logExerciseId = logExerciseId;
            record.reps = warmup.reps;
            record.weight = warmup.weightKg;
            record.partials = 0;
            record.restTimeAfter = options.restTimeAfter ?? anchorRestTimeAfter;
            record.repsInReserve = 0;
            record.rirRecorded = false;
            record.completionStatus = 'planned';
            record.setType = WARMUP_SET_TYPE;
            record.setOrder = anchorOrder + index;
            record.createdAt = now;
            record.updatedAt = now;
          })
        ),
      ];

      for (let start = 0; start < operations.length; start += MAX_BATCH_OPERATIONS) {
        await database.batch(...operations.slice(start, start + MAX_BATCH_OPERATIONS));
      }
      return count;
    });
  }

  /**
   * Removes the warm-ups of an exercise that have not been done yet. A performed warm-up is
   * history and stays; remaining gaps in `set_order` are harmless because it is only ever compared.
   */
  static async removePlannedWarmupSets(logExerciseId: string): Promise<number> {
    return await database.write(async () => {
      const sets = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(Q.where('log_exercise_id', logExerciseId), Q.where('deleted_at', Q.eq(null)))
        .fetch();
      const planned = sets.filter((set) => isWarmupSet(set) && isPlannedWorkoutSet(set));
      if (planned.length === 0) {
        return 0;
      }

      const now = Date.now();
      await database.batch(...planned.map((set) => prepareSoftDelete(set, now)));
      return planned.length;
    });
  }
}
