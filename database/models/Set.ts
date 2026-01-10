import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import type { Associations } from '@nozbe/watermelondb/Model';
import WorkoutExercise from './WorkoutExercise';

export default class Set extends Model {
  static table = 'sets';

  static associations: Associations = {
    workout_exercises: { type: 'belongs_to', key: 'workout_exercise_id' },
  };

  @relation('workout_exercises', 'workout_exercise_id')
  workoutExercise!: WorkoutExercise;

  @field('reps') reps!: number;
  @field('partial_reps') partialReps?: number;
  @field('weight') weight?: number;
  @field('difficulty') difficulty?: number;
  @field('is_completed') isCompleted!: boolean;
  @field('is_bodyweight') isBodyweight!: boolean;
  @field('extra_weight') extraWeight?: number;
  @field('completed_at') completedAt?: number;
}
