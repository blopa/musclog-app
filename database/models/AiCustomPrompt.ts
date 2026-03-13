import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class AiCustomPrompt extends Model {
  static table = 'ai_custom_prompts';

  @field('name') name!: string;
  @field('content') content!: string;
  @field('is_active') isActive!: boolean;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
