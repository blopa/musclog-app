import { Model, Query } from '@nozbe/watermelondb';
import { children, field, relation, writer } from '@nozbe/watermelondb/decorators';

import Exercise from './Exercise';
import WorkoutLog from './WorkoutLog';
import WorkoutLogSet from './WorkoutLogSet';
import WorkoutTemplateExercise from './WorkoutTemplateExercise';

export default class WorkoutLogExercise extends Model {
  static table = 'workout_log_exercises';

  static associations = {
    workout_logs: { type: 'belongs_to' as const, key: 'workout_log_id' },
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
    workout_template_exercises: { type: 'belongs_to' as const, key: 'template_exercise_id' },
    workout_log_sets: { type: 'has_many' as const, foreignKey: 'log_exercise_id' },
  };

  @field('workout_log_id') workoutLogId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('template_exercise_id') templateExerciseId?: string;
  @field('notes') notes?: string;
  @field('exercise_order') exerciseOrder!: number;
  @field('group_id') groupId?: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('workout_logs', 'workout_log_id') workoutLog!: WorkoutLog;
  @relation('exercises', 'exercise_id') exercise!: Exercise;
  @relation('workout_template_exercises', 'template_exercise_id')
  templateExercise?: WorkoutTemplateExercise;
  @children('workout_log_sets') sets!: Query<WorkoutLogSet>;

  @writer
  async markAsDeleted(): Promise<void> {
    const now = Date.now();
    await this.update((record) => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
  }
}
