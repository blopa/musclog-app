import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

import WorkoutTemplateExercise from './WorkoutTemplateExercise';

export default class WorkoutTemplateSet extends Model {
  static table = 'workout_template_sets';

  static associations = {
    workout_template_exercises: { type: 'belongs_to' as const, key: 'template_exercise_id' },
  };

  @field('template_exercise_id') templateExerciseId!: string;
  @field('target_reps') targetReps!: number;
  @field('target_weight') targetWeight!: number;
  @field('rest_time_after') restTimeAfter?: number;
  @field('set_order') setOrder!: number;
  @field('is_drop_set') isDropSet!: boolean;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('workout_template_exercises', 'template_exercise_id')
  templateExercise!: WorkoutTemplateExercise;

  @writer
  async markAsDeleted(): Promise<void> {
    const now = Date.now();
    await this.update((record) => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
  }
}
