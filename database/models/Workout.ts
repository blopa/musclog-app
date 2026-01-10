import { Model } from '@nozbe/watermelondb';
import { field, children } from '@nozbe/watermelondb/decorators';
import type { Associations } from '@nozbe/watermelondb/Model';
import WorkoutExercise from './WorkoutExercise';

export default class Workout extends Model {
  static table = 'workouts';

  static associations: Associations = {
    workout_exercises: { type: 'has_many', foreignKey: 'workout_id' },
  };

  @field('name') name!: string;
  @field('description') description?: string;
  @field('is_template') isTemplate!: boolean;
  @field('repeat_days') repeatDays?: string;
  @field('volume_calc_method') volumeCalcMethod?: string;

  @children('workout_exercises') workoutExercises!: any;
}
