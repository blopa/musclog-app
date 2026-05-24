import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type AiCustomPromptContext = 'nutrition' | 'exercise' | 'general';
export type AiCustomPromptType = 'system' | 'memory';

export default class AiCustomPrompt extends Model {
  static table = 'ai_custom_prompts';

  @field('name') declare name: string;
  @field('content') declare content: string;
  @field('context') declare context: AiCustomPromptContext;
  @field('type') declare type: AiCustomPromptType;
  @field('is_active') declare isActive: boolean;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;
}
