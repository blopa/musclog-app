import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class ExerciseMuscle extends Model {
  static table = 'exercise_muscles';

  @field('exercise_id') exerciseId!: string;
  @field('muscle_id') muscleId!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
