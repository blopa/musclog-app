import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Exercise extends Model {
  static table = 'exercises';

  @field('name') name!: string;
  @field('muscle_group') muscleGroup!: string;
  @field('image_url') imageUrl?: string;
  @field('is_custom') isCustom!: boolean;
}
