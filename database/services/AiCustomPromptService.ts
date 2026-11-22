import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import AiCustomPrompt, {
  type AiCustomPromptContext,
  type AiCustomPromptType,
} from '@/database/models/AiCustomPrompt';
import { classifyMemory } from '@/utils/coachMemories';

import SettingsService from './SettingsService';

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
  static async getActivePrompts(
    context?: AiCustomPromptContext,
    type?: AiCustomPromptType
  ): Promise<AiCustomPrompt[]> {
    let query = database
      .get<AiCustomPrompt>('ai_custom_prompts')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('is_active', Q.eq(true)));

    if (context) {
      query = query.extend(Q.where('context', Q.eq(context)));
    }

    if (type === 'system') {
      query = query.extend(Q.or(Q.where('type', Q.eq('system')), Q.where('type', Q.eq(null))));
    } else if (type) {
      query = query.extend(Q.where('type', Q.eq(type)));
    }

    return await query.extend(Q.sortBy('created_at', Q.desc)).fetch();
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
   * Get every active memory across all contexts, newest first (for the coach prompt)
   */
  static async getMemoriesForPrompt(): Promise<AiCustomPrompt[]> {
    return await database
      .get<AiCustomPrompt>('ai_custom_prompts')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('is_active', Q.eq(true)),
        Q.where('type', Q.eq('memory')),
        Q.sortBy('created_at', Q.desc)
      )
      .fetch();
  }

  /**
   * Create a new custom prompt.
   *
   * Memories are shared across contexts: a memory that repeats an active one is not
   * inserted (the existing record is returned), one that replaces an older fact
   * soft-deletes that fact, and the cap counts memories of every context.
   */
  static async createPrompt(
    name: string,
    content: string,
    isActive: boolean = true,
    context: AiCustomPromptContext = 'general',
    type: AiCustomPromptType = 'system'
  ): Promise<AiCustomPrompt> {
    return await database.write(async () => {
      const now = Date.now();

      if (type === 'memory') {
        const maxMemories = await SettingsService.getMaxAiMemories();
        const existingMemories = await database
          .get<AiCustomPrompt>('ai_custom_prompts')
          .query(
            Q.where('deleted_at', Q.eq(null)),
            Q.where('is_active', Q.eq(true)),
            Q.where('type', 'memory'),
            Q.sortBy('created_at', Q.desc)
          )
          .fetch();

        const verdict = classifyMemory(
          content,
          existingMemories.map((memory) => memory.content)
        );

        if (verdict.kind === 'duplicate') {
          return existingMemories[verdict.index];
        }

        let remaining = existingMemories;
        if (verdict.kind === 'supersedes') {
          const replaced = existingMemories[verdict.index];
          await replaced.update((record) => {
            record.deletedAt = now;
            record.updatedAt = now;
          });
          remaining = existingMemories.filter((memory) => memory !== replaced);
        }

        if (remaining.length >= maxMemories) {
          // Soft delete the oldest memories
          const toDelete = remaining.slice(maxMemories - 1);
          for (const oldMemory of toDelete) {
            await oldMemory.update((record) => {
              record.deletedAt = now;
              record.updatedAt = now;
            });
          }
        }
      }

      return await database.get<AiCustomPrompt>('ai_custom_prompts').create((prompt) => {
        prompt.name = name;
        prompt.content = content;
        prompt.context = context;
        prompt.type = type;
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
      context?: AiCustomPromptContext;
      type?: AiCustomPromptType;
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

        if (updates.context !== undefined) {
          record.context = updates.context;
        }

        if (updates.type !== undefined) {
          record.type = updates.type;
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
