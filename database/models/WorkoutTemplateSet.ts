import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

import WorkoutTemplateExercise from './WorkoutTemplateExercise';

export default class WorkoutTemplateSet extends Model {
  static table = 'workout_template_sets';

  static associations = {
    workout_template_exercises: { type: 'belongs_to' as const, key: 'template_exercise_id' },
  };

  @field('template_exercise_id') declare templateExerciseId: string;
  @field('target_reps') declare targetReps: number;
  @field('target_weight') declare targetWeight: number;
  @field('rest_time_after') restTimeAfter?: number;
  @field('set_order') declare setOrder: number;
  @field('set_type') declare setType: string;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
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
