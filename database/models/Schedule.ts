import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

import WorkoutTemplate from './WorkoutTemplate';

export type DayOfWeek =
  'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export default class Schedule extends Model {
  static table = 'schedules';

  static associations = {
    workout_templates: { type: 'belongs_to' as const, key: 'template_id' },
  };

  @field('template_id') declare templateId: string;
  @field('day_of_week') declare dayOfWeek: DayOfWeek;
  @field('reminder_time') reminderTime?: string;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @relation('workout_templates', 'template_id') declare template: WorkoutTemplate;
}
