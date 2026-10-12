import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

/**
 * What the user has said about an exercise itself: the unit its weights are shown in and a note
 * that follows it into every session. At most one live row per exercise —
 * `ExerciseUserSettingsService` updates it in place rather than stacking rows.
 */
export default class ExerciseUserSettings extends Model {
  static table = 'exercise_user_settings';

  static associations = {
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
  };

  @field('exercise_id') declare exerciseId: string;
  @field('weight_unit') weightUnit?: string;
  @field('note') note?: string;
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
