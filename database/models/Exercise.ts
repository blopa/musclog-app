import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Exercise extends Model {
  static table = 'exercises';

  @field('name') name!: string;
  @field('description') description!: string;
  @field('image_url') imageUrl?: string;
  @field('muscle_group') muscleGroup!: string;
  @field('equipment_type') equipmentType!: string;
  @field('mechanic_type') mechanicType!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
