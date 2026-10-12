import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

/**
 * A user-defined alternative name for an exercise ("BP" for bench press). Never edit one directly:
 * `ExerciseAliasService` rewrites the owning exercise's `search_text` in the same write, which is
 * the only reason an alias is searchable.
 */
export default class ExerciseAlias extends Model {
  static table = 'exercise_aliases';

  static associations = {
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
  };

  @field('exercise_id') declare exerciseId: string;
  @field('alias') declare alias: string;
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
