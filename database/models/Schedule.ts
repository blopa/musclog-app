import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Schedule extends Model {
  static table = 'schedules';

  @field('template_id') templateId!: string;
  @field('day_of_week') dayOfWeek!: string;
  @field('reminder_time') reminderTime?: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
