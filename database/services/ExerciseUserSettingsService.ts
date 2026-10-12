import { Q, type Query } from '@nozbe/watermelondb';

import type { Units } from '@/constants/settings';
import { database } from '@/database/database-instance';
import type ExerciseUserSettings from '@/database/models/ExerciseUserSettings';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
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
 * What the user has said about an exercise itself: the unit its weights are shown in and a note
 * that follows it into every session. One live row per exercise, updated in place; a row whose
 * every field has been cleared is retired rather than kept as an empty shell, so "has settings"
 * and "has a row" mean the same thing.
 */
export class ExerciseUserSettingsService {
  /** Live rows. Observe with `observeWithColumns` — a row is updated in place. */
  static settingsQuery(): Query<ExerciseUserSettings> {
    return database
      .get<ExerciseUserSettings>('exercise_user_settings')
      .query(Q.where('deleted_at', Q.eq(null)));
  }

  /**
   * "Which unit are this exercise's weights in?" for code outside React — the service-side twin of
   * `useExerciseUserSettings().unitsFor`, applying the same exercise → gym → account rule. Reads the
   * account unit and every override once, so a caller resolving many exercises pays for one read.
   * The gym is passed in because every caller that needs this has already read it.
   */
  static async getWeightUnitsResolver(
    gym: Pick<GymSnapshot, 'weightUnit'> | null
  ): Promise<(exerciseId: string) => Units> {
    const [account, rows] = await Promise.all([
      SettingsService.getUnits(),
      ExerciseUserSettingsService.settingsQuery().fetch(),
    ]);
    const overrides = weightUnitOverridesOf(rows);
    return (exerciseId) =>
      resolveWeightUnits({ account, gym: gym?.weightUnit, exercise: overrides.get(exerciseId) });
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

      const operations = duplicates.map((row) => prepareSoftDelete(row, now));
      if (safeUnit === undefined && note === undefined) {
        if (keep) {
          operations.push(prepareSoftDelete(keep, now));
        }
      } else if (keep) {
        operations.push(
          keep.prepareUpdate((row) => {
            row.weightUnit = safeUnit;
            row.note = note;
            row.updatedAt = now;
          })
        );
      } else {
        operations.push(
          collection.prepareCreate((row) => {
            row.exerciseId = exerciseId;
            row.weightUnit = safeUnit;
            row.note = note;
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
}
