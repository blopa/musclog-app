import { Q, type Query } from '@nozbe/watermelondb';

import type { Units } from '@/constants/settings';
import { database } from '@/database/database-instance';
import type ExerciseUserSettings from '@/database/models/ExerciseUserSettings';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import {
  defaultRepCeilingFor,
  resolveRepCeiling,
  storedRepCeiling,
} from '@/utils/bodyweightRepCeiling';
import type { GymSnapshot } from '@/utils/gym';
import { normalizeNote } from '@/utils/noteText';
import {
  isWeightUnitOverride,
  resolveWeightUnits,
  type WeightUnitOverride,
} from '@/utils/unitConversion';

import { SettingsService } from './SettingsService';

export interface ExerciseUserSettingsPatch {
  /** `null` clears the override; `undefined` leaves it as it is. */
  weightUnit?: WeightUnitOverride | null;
  /** `null` or blank clears the note; `undefined` leaves it as it is. */
  note?: string | null;
  /** `null` (or the default ceiling) clears it; `undefined` leaves it as it is. */
  repCeiling?: number | null;
}

/** Every pinned weight unit by exercise id. A value this build does not understand is skipped. */
export function weightUnitOverridesOf(
  rows: readonly Pick<ExerciseUserSettings, 'exerciseId' | 'weightUnit'>[]
): Map<string, WeightUnitOverride> {
  const map = new Map<string, WeightUnitOverride>();
  for (const row of rows) {
    if (isWeightUnitOverride(row.weightUnit)) {
      map.set(row.exerciseId, row.weightUnit);
    }
  }

  return map;
}

/**
 * What the user has said about an exercise itself: the unit its weights are shown in, a note that
 * follows it into every session and, for bodyweight work, the reps it climbs to. One live row per exercise, updated in place; a row whose
 * every field has been cleared is retired rather than kept as an empty shell, so "has settings"
 * and "has a row" mean the same thing.
 */
/** What resolving a rep ceiling needs to know about the exercise: whose it is, and how much of
 * the body it moves (which sets the default). */
export type RepCeilingExercise = { id: string; loadMultiplier?: number | null };

export class ExerciseUserSettingsService {
  /** Live rows. Observe with `observeWithColumns` — a row is updated in place. */
  static settingsQuery(): Query<ExerciseUserSettings> {
    return database
      .get<ExerciseUserSettings>('exercise_user_settings')
      .query(Q.where('deleted_at', Q.eq(null)));
  }

  /**
   * The per-exercise answers code outside React needs, read once: "which unit are this exercise's
   * weights in?" — the service-side twin of `useExerciseUserSettings().unitsFor`, applying the same
   * exercise → gym → account rule — and "how many reps does this bodyweight exercise climb to?".
   * The gym is passed in because every caller that needs this has already read it.
   */
  static async getResolvers(gym: Pick<GymSnapshot, 'weightUnit'> | null): Promise<{
    unitsFor: (exerciseId: string) => Units;
    repCeilingFor: (exercise: RepCeilingExercise) => number;
  }> {
    const [account, rows] = await Promise.all([
      SettingsService.getUnits(),
      ExerciseUserSettingsService.settingsQuery().fetch(),
    ]);
    const overrides = weightUnitOverridesOf(rows);
    const ceilings = new Map(rows.map((row) => [row.exerciseId, row.repCeiling]));
    return {
      unitsFor: (exerciseId) =>
        resolveWeightUnits({ account, gym: gym?.weightUnit, exercise: overrides.get(exerciseId) }),
      repCeilingFor: (exercise) =>
        resolveRepCeiling(ceilings.get(exercise.id), defaultRepCeilingFor(exercise.loadMultiplier)),
    };
  }

  /** {@link getResolvers}' unit half, for callers that need nothing else. */
  static async getWeightUnitsResolver(
    gym: Pick<GymSnapshot, 'weightUnit'> | null
  ): Promise<(exerciseId: string) => Units> {
    return (await ExerciseUserSettingsService.getResolvers(gym)).unitsFor;
  }

  static async getFor(exerciseId: string): Promise<ExerciseUserSettings | null> {
    const rows = await database
      .get<ExerciseUserSettings>('exercise_user_settings')
      .query(Q.where('exercise_id', exerciseId), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    return rows[0] ?? null;
  }

  /**
   * Applies a patch to an exercise's settings in one write. The read happens inside the writer, so
   * two quick edits (unit, then note) cannot both see "no row" and each create one.
   */
  static async update(exerciseId: string, patch: ExerciseUserSettingsPatch): Promise<void> {
    await database.write(async () => {
      const collection = database.get<ExerciseUserSettings>('exercise_user_settings');
      const rows = await collection
        .query(Q.where('exercise_id', exerciseId), Q.where('deleted_at', Q.eq(null)))
        .fetch();
      const [keep, ...duplicates] = rows;
      const now = Date.now();

      const weightUnit =
        patch.weightUnit === undefined
          ? (keep?.weightUnit ?? undefined)
          : (patch.weightUnit ?? undefined);
      const rawNote = patch.note === undefined ? keep?.note : patch.note;
      const note = normalizeNote(rawNote);
      // A value this build does not understand is dropped rather than stored.
      const safeUnit = isWeightUnitOverride(weightUnit) ? weightUnit : undefined;
      const repCeiling = storedRepCeiling(
        patch.repCeiling === undefined ? keep?.repCeiling : patch.repCeiling
      );

      const operations = duplicates.map((row) => prepareSoftDelete(row, now));
      if (safeUnit === undefined && note === undefined && repCeiling === undefined) {
        if (keep) {
          operations.push(prepareSoftDelete(keep, now));
        }
      } else if (keep) {
        operations.push(
          keep.prepareUpdate((row) => {
            row.weightUnit = safeUnit;
            row.note = note;
            row.repCeiling = repCeiling;
            row.updatedAt = now;
          })
        );
      } else {
        operations.push(
          collection.prepareCreate((row) => {
            row.exerciseId = exerciseId;
            row.weightUnit = safeUnit;
            row.note = note;
            row.repCeiling = repCeiling;
            row.createdAt = now;
            row.updatedAt = now;
            row.deletedAt = undefined;
          })
        );
      }

      if (operations.length > 0) {
        await database.batch(...operations);
      }
    });
  }

  static async setWeightUnit(exerciseId: string, weightUnit: WeightUnitOverride | null) {
    await ExerciseUserSettingsService.update(exerciseId, { weightUnit });
  }

  static async setNote(exerciseId: string, note: string | null) {
    await ExerciseUserSettingsService.update(exerciseId, { note });
  }

  static async setRepCeiling(exerciseId: string, repCeiling: number | null) {
    await ExerciseUserSettingsService.update(exerciseId, { repCeiling });
  }
}
