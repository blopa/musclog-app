import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import WorkoutTemplate from './WorkoutTemplate';
import Exercise from './Exercise';

export default class WorkoutTemplateSet extends Model {
  static table = 'workout_template_sets';

  static associations = {
    workout_templates: { type: 'belongs_to' as const, key: 'template_id' },
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
  };

  @field('template_id') templateId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('target_reps') targetReps!: number;
  @field('target_weight') targetWeight!: number;
  @field('rest_time_after') restTimeAfter?: number;
  @field('set_order') setOrder!: number;
  @field('group_id') groupId?: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('workout_templates', 'template_id') template!: WorkoutTemplate;
  @relation('exercises', 'exercise_id') exercise!: Exercise;
}
