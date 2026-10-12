import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

import type { RestrictionKind } from '@/utils/exerciseSubstitution';

/**
 * An exercise the user does not want suggested. At most one live row per exercise —
 * `ExerciseRestrictionService.set` replaces instead of stacking, so a row's `kind` is the answer,
 * not one vote among several.
 */
export default class ExerciseRestriction extends Model {
  static table = 'exercise_restrictions';

  static associations = {
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
  };

  @field('exercise_id') declare exerciseId: string;
  @field('kind') declare kind: RestrictionKind;
  @field('note') note?: string;
  @field('expires_at') expiresAt?: number;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @writer
  async markAsDeleted(): Promise<void> {
    const now = Date.now();
    await this.update((record) => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
  }
}
