import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { database } from '../database';
import AiCustomPrompt from '../database/models/AiCustomPrompt';
import { AiCustomPromptService } from '../database/services';

export interface UseAiCustomPromptsParams {
  activeOnly?: boolean;
  enableReactivity?: boolean;
}

export type UseAiCustomPromptsResult = {
  prompts: AiCustomPrompt[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  createPrompt: (name: string, content: string, isActive?: boolean) => Promise<AiCustomPrompt>;
  updatePrompt: (
    id: string,
    updates: { name?: string; content?: string; isActive?: boolean }
  ) => Promise<AiCustomPrompt>;
  deletePrompt: (id: string) => Promise<void>;
  togglePromptActive: (id: string) => Promise<AiCustomPrompt>;
};

export function useAiCustomPrompts({
  activeOnly = false,
  enableReactivity = true,
}: UseAiCustomPromptsParams = {}): UseAiCustomPromptsResult {
  const [prompts, setPrompts] = useState<AiCustomPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPrompts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = activeOnly
        ? await AiCustomPromptService.getActivePrompts()
        : await AiCustomPromptService.getAllPrompts();
      setPrompts(data);
    } catch (err) {
      console.error('Error loading AI custom prompts:', err);
      setPrompts([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeOnly]);

  const refresh = useCallback(async () => {
    await loadPrompts();
  }, [loadPrompts]);

  const createPrompt = useCallback(
    async (name: string, content: string, isActive: boolean = true) => {
      const newPrompt = await AiCustomPromptService.createPrompt(name, content, isActive);
      if (!enableReactivity) {
        await loadPrompts();
      }
      return newPrompt;
    },
    [enableReactivity, loadPrompts]
  );

  const updatePrompt = useCallback(
    async (id: string, updates: { name?: string; content?: string; isActive?: boolean }) => {
      const updated = await AiCustomPromptService.updatePrompt(id, updates);
      if (!enableReactivity) {
        await loadPrompts();
      }
      return updated;
    },
    [enableReactivity, loadPrompts]
  );

  const deletePrompt = useCallback(
    async (id: string) => {
      await AiCustomPromptService.deletePrompt(id);
      if (!enableReactivity) {
        await loadPrompts();
      }
    },
    [enableReactivity, loadPrompts]
  );

  const togglePromptActive = useCallback(
    async (id: string) => {
      const toggled = await AiCustomPromptService.togglePromptActive(id);
      if (!enableReactivity) {
        await loadPrompts();
      }
      return toggled;
    },
    [enableReactivity, loadPrompts]
  );

  useEffect(() => {
    if (!enableReactivity) {
      loadPrompts();
      return;
    }

    const query = database
      .get<AiCustomPrompt>('ai_custom_prompts')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc));

    const subscription = query.observe().subscribe({
      next: (data) => {
        if (activeOnly) {
          setPrompts(data.filter((p) => p.isActive));
        } else {
          setPrompts(data);
        }
        setIsLoading(false);
      },
      error: (err) => {
        console.error('Error observing AI custom prompts:', err);
      },
    });

    return () => subscription.unsubscribe();
  }, [enableReactivity, activeOnly, loadPrompts]);

  return useMemo(
    () => ({
      prompts,
      isLoading,
      refresh,
      createPrompt,
      updatePrompt,
      deletePrompt,
      togglePromptActive,
    }),
    [prompts, isLoading, refresh, createPrompt, updatePrompt, deletePrompt, togglePromptActive]
  );
}

export default useAiCustomPrompts;
