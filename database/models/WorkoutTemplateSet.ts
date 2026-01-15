import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class WorkoutTemplateSet extends Model {
  static table = 'workout_template_sets';

  @field('template_id') templateId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('target_reps') targetReps!: number;
  @field('target_weight') targetWeight!: number;
  @field('set_order') setOrder!: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
