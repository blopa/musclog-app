import { Model, Q } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import WorkoutTemplate from './WorkoutTemplate';
import { database } from '../index';

export default class Schedule extends Model {
  static table = 'schedules';

  static associations = {
    workout_templates: { type: 'belongs_to', key: 'template_id' },
  };

  @field('template_id') templateId!: string;
  @field('day_of_week') dayOfWeek!: string;
  @field('reminder_time') reminderTime?: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('workout_templates', 'template_id') template!: WorkoutTemplate;

  static getForDay(dayOfWeek: string): Q.Query<Schedule> {
    return database
      .get<Schedule>('schedules')
      .query(Q.where('day_of_week', dayOfWeek), Q.where('deleted_at', Q.eq(null)));
  }
}
