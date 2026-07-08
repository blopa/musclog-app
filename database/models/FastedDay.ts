import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class FastedDay extends Model {
  static table = 'fasted_days';

  @field('date') declare date: number;
  @field('timezone') declare timezone: string | null;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') declare deletedAt: number | null;
}
