import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Muscle extends Model {
  static table = 'muscles';

  @field('name') name!: string;
  @field('muscle_group') muscleGroup!: string;
  @field('display_name') displayName!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
