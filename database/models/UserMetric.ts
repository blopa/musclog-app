import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class UserMetric extends Model {
  static table = 'user_metrics';

  @field('type') type!: string;
  @field('value') value!: number;
  @field('unit') unit!: string;
  @field('date') date!: number;
  @field('timezone') timezone!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
