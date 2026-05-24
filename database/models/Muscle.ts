import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Muscle extends Model {
  static table = 'muscles';

  @field('name') declare name: string;
  @field('muscle_group') declare muscleGroup: string;
  @field('display_name') declare displayName: string;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;
}
