import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import AiCustomPrompt from '../models/AiCustomPrompt';

export class AiCustomPromptService {
  /**
   * Get all custom prompts (non-deleted)
   */
  static async getAllPrompts(): Promise<AiCustomPrompt[]> {
    return await database
      .get<AiCustomPrompt>('ai_custom_prompts')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc))
      .fetch();
  }

  /**
   * Get all active custom prompts (non-deleted)
   */
  static async getActivePrompts(): Promise<AiCustomPrompt[]> {
    return await database
      .get<AiCustomPrompt>('ai_custom_prompts')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('is_active', Q.eq(true)),
        Q.sortBy('created_at', Q.desc)
      )
      .fetch();
  }

  /**
   * Get custom prompt by ID
   */
  static async getPromptById(id: string): Promise<AiCustomPrompt | null> {
    try {
      const prompt = await database.get<AiCustomPrompt>('ai_custom_prompts').find(id);
      return prompt.deletedAt ? null : prompt;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a new custom prompt
   */
  static async createPrompt(
    name: string,
    content: string,
    isActive: boolean = true
  ): Promise<AiCustomPrompt> {
    return await database.write(async () => {
      const now = Date.now();

      return await database.get<AiCustomPrompt>('ai_custom_prompts').create((prompt) => {
        prompt.name = name;
        prompt.content = content;
        prompt.isActive = isActive;
        prompt.createdAt = now;
        prompt.updatedAt = now;
      });
    });
  }

  /**
   * Update custom prompt
   */
  static async updatePrompt(
    id: string,
    updates: {
      name?: string;
      content?: string;
      isActive?: boolean;
    }
  ): Promise<AiCustomPrompt> {
    return await database.write(async () => {
      const prompt = await database.get<AiCustomPrompt>('ai_custom_prompts').find(id);

      if (prompt.deletedAt) {
        throw new Error('Cannot update deleted prompt');
      }

      await prompt.update((record) => {
        if (updates.name !== undefined) {
          record.name = updates.name;
        }
        if (updates.content !== undefined) {
          record.content = updates.content;
        }
        if (updates.isActive !== undefined) {
          record.isActive = updates.isActive;
        }
        record.updatedAt = Date.now();
      });

      return prompt;
    });
  }

  /**
   * Delete custom prompt (soft delete)
   */
  static async deletePrompt(id: string): Promise<void> {
    const prompt = await database.get<AiCustomPrompt>('ai_custom_prompts').find(id);
    await prompt.markAsDeleted();
  }

  /**
   * Toggle prompt active status
   */
  static async togglePromptActive(id: string): Promise<AiCustomPrompt> {
    return await database.write(async () => {
      const prompt = await database.get<AiCustomPrompt>('ai_custom_prompts').find(id);

      if (prompt.deletedAt) {
        throw new Error('Cannot toggle deleted prompt');
      }

      await prompt.update((record) => {
        record.isActive = !record.isActive;
        record.updatedAt = Date.now();
      });

      return prompt;
    });
  }
}
