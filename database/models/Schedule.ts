import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

import WorkoutTemplate from './WorkoutTemplate';

export default class Schedule extends Model {
  static table = 'schedules';

  static associations = {
    workout_templates: { type: 'belongs_to' as const, key: 'template_id' },
  };

  @field('template_id') templateId!: string;
  @field('day_of_week') dayOfWeek!: string;
  @field('reminder_time') reminderTime?: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('workout_templates', 'template_id') template!: WorkoutTemplate;
}
