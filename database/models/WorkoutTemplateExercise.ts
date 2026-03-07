import { Model, Query } from '@nozbe/watermelondb';
import { children, field, relation, writer } from '@nozbe/watermelondb/decorators';

import Exercise from './Exercise';
import WorkoutTemplate from './WorkoutTemplate';
import WorkoutTemplateSet from './WorkoutTemplateSet';

export default class WorkoutTemplateExercise extends Model {
  static table = 'workout_template_exercises';

  static associations = {
    workout_templates: { type: 'belongs_to' as const, key: 'template_id' },
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
    workout_template_sets: { type: 'has_many' as const, foreignKey: 'template_exercise_id' },
  };

  @field('template_id') templateId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('notes') notes?: string;
  @field('exercise_order') exerciseOrder!: number;
  @field('group_id') groupId?: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('workout_templates', 'template_id') template!: WorkoutTemplate;
  @relation('exercises', 'exercise_id') exercise!: Exercise;
  @children('workout_template_sets') sets!: Query<WorkoutTemplateSet>;

  @writer
  async markAsDeleted(): Promise<void> {
    const now = Date.now();
    await this.update((record) => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
  }
}
