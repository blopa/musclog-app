import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_BATCH_SIZE } from '../constants/database';
import { WorkoutTemplateRepository } from '../database';
import { WorkoutTemplateService } from '../database/services';

export type WorkoutTemplateWithMetadata = {
  id: string;
  name: string;
  description?: string;
  type?: string;
  icon?: string;
  exerciseCount: number;
  lastCompleted?: string;
  lastCompletedTimestamp?: number;
  duration?: string;
};

// Hook parameters
export interface UseWorkoutTemplatesParams {
  mode?: 'all' | 'paginated'; // Default: 'all'
  initialLimit?: number; // For paginated mode, default: 5 (ignored if getAll is true)
  batchSize?: number; // For paginated mode, default: 5 (ignored if getAll is true)
  getAll?: boolean; // For paginated mode: if true, fetch all templates (no pagination)
  enableReactivity?: boolean; // Default: true
  visible?: boolean; // For modal visibility control, default: true
  scope?: 'active' | 'archived'; // Default: 'active'
}

// Return type for all mode
export type UseWorkoutTemplatesResultAll = {
  templates: WorkoutTemplateWithMetadata[];
  isLoading: boolean;
  error: string | null;
};

// Return type for paginated mode
export type UseWorkoutTemplatesResultPaginated = {
  templates: WorkoutTemplateWithMetadata[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  error: string | null;
};

export type UseWorkoutTemplatesResult =
  | UseWorkoutTemplatesResultAll
  | UseWorkoutTemplatesResultPaginated;

// Function overloads for proper type narrowing
export function useWorkoutTemplates(
  params?: UseWorkoutTemplatesParams & { mode?: 'all' }
): UseWorkoutTemplatesResultAll;

export function useWorkoutTemplates(
  params: UseWorkoutTemplatesParams & { mode: 'paginated' }
): UseWorkoutTemplatesResultPaginated;

export function useWorkoutTemplates({
  mode = 'all',
  initialLimit = 5,
  batchSize = DEFAULT_BATCH_SIZE,
  getAll = false,
  enableReactivity = true,
  visible = true,
  scope = 'active',
}: UseWorkoutTemplatesParams = {}): UseWorkoutTemplatesResult {
  // State for all mode
  const [allTemplates, setAllTemplates] = useState<WorkoutTemplateWithMetadata[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const [errorAll, setErrorAll] = useState<string | null>(null);

  // State for paginated mode
  const [templates, setTemplates] = useState<WorkoutTemplateWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load initial batch of templates (paginated mode)
  const loadInitialTemplates = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);
    setError(null);

    try {
      let templatesHistory: WorkoutTemplateWithMetadata[];

      if (getAll) {
        // Fetch all templates (no pagination)
        templatesHistory = await WorkoutTemplateService.getTemplatesWithMetadataPaginated(
          undefined,
          undefined,
          scope
        );
        // No limit or offset - gets all
        setHasMore(false); // No more to load when getAll is true
      } else {
        // Fetch initial batch with pagination
        setHasMore(true);
        templatesHistory = await WorkoutTemplateService.getTemplatesWithMetadataPaginated(
          initialLimit,
          undefined,
          scope
        );

        if (templatesHistory.length === 0) {
          setTemplates([]);
          setHasMore(false);
          setIsLoading(false);
          return;
        }

        setCurrentOffset(initialLimit);

        // Check if there are more templates
        if (templatesHistory.length < initialLimit) {
          setHasMore(false);
        } else {
          // Check if there's a next batch
          const nextBatch = await WorkoutTemplateService.getTemplatesWithMetadataPaginated(
            1,
            initialLimit,
            scope
          );
          setHasMore(nextBatch.length > 0);
        }
      }

      if (templatesHistory.length === 0) {
        setTemplates([]);
        setIsLoading(false);
        return;
      }

      setTemplates(templatesHistory);
    } catch (err) {
      console.error('Error loading workout templates history:', err);
      setTemplates([]);
      setHasMore(false);
      setError(err instanceof Error ? err.message : 'Failed to load workout templates');
    } finally {
      setIsLoading(false);
    }
  }, [visible, initialLimit, getAll, scope]);

  // Load more templates (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !visible || getAll) {
      // Don't load more if getAll is true (all templates already loaded)
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    // Small delay to ensure React processes the state update and shows loading state
    await new Promise<void>((resolve) => setTimeout(resolve, 1));

    try {
      // Fetch next batch
      const templatesHistory = await WorkoutTemplateService.getTemplatesWithMetadataPaginated(
        batchSize,
        currentOffset,
        scope
      );

      if (templatesHistory.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Append to existing templates
      setTemplates((prev) => [...prev, ...templatesHistory]);

      const newOffset = currentOffset + templatesHistory.length;
      setCurrentOffset(newOffset);

      // Check if there are more templates
      if (templatesHistory.length < batchSize) {
        setHasMore(false);
      } else {
        // Check if there's a next batch
        const nextBatch = await WorkoutTemplateService.getTemplatesWithMetadataPaginated(
          1,
          newOffset,
          scope
        );
        setHasMore(nextBatch.length > 0);
      }
    } catch (err) {
      console.error('Error loading more workout templates:', err);
      setHasMore(false);
      setError(err instanceof Error ? err.message : 'Failed to load more workout templates');
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize, getAll, scope]);

  // All mode: Observe templates based on scope
  useEffect(() => {
    if (mode !== 'all') {
      return;
    }

    // Use the appropriate repository query based on scope
    const query =
      scope === 'archived'
        ? WorkoutTemplateRepository.getArchived()
        : WorkoutTemplateRepository.getActive();

    const subscription = query.observe().subscribe({
      next: async (_templatesList) => {
        // Note: We don't use templatesList directly because getAllTemplatesWithMetadata()
        // performs its own query with additional processing (exercise counts, last completed, etc.)
        // The observable triggers the update, but we re-fetch to get fully processed data
        try {
          setErrorAll(null);
          // Process templates with metadata when they change
          const templatesWithMetadata =
            await WorkoutTemplateService.getAllTemplatesWithMetadata(scope);
          setAllTemplates(templatesWithMetadata);
          setIsLoadingAll(false);
        } catch (err) {
          console.error('Error processing workout templates:', err);
          setErrorAll(err instanceof Error ? err.message : 'Failed to load workout templates');
          setAllTemplates([]);
          setIsLoadingAll(false);
        }
      },
      error: (err) => {
        console.error('Error observing workout templates:', err);
        setErrorAll(err instanceof Error ? err.message : 'Failed to load workout templates');
        setAllTemplates([]);
        setIsLoadingAll(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [mode, scope]);

  // Paginated mode: Observe for new templates to trigger reload (reactivity)
  useEffect(() => {
    if (mode !== 'paginated') {
      return;
    }

    if (!enableReactivity || !visible) {
      // Still load initial data even if reactivity is disabled
      if (visible) {
        loadInitialTemplates();
      }
      return;
    }

    // Observe workout templates to detect when new ones are created/updated
    // Use the appropriate repository query based on scope
    const query =
      scope === 'archived'
        ? WorkoutTemplateRepository.getArchived()
        : WorkoutTemplateRepository.getActive();
    const observeQuery = query.extend(Q.take(1)); // Only need to know if there are any changes

    const subscription = observeQuery.observe().subscribe({
      next: () => {
        // When a new template is created/updated, reload the initial batch
        loadInitialTemplates();
      },
      error: (err) => {
        console.error('Error observing workout templates:', err);
      },
    });

    // Load initial data
    loadInitialTemplates();

    return () => subscription.unsubscribe();
  }, [mode, enableReactivity, visible, getAll, scope, loadInitialTemplates]);

  // All mode result
  const allResult = useMemo(
    () => ({
      templates: allTemplates,
      isLoading: isLoadingAll,
      error: errorAll,
    }),
    [allTemplates, isLoadingAll, errorAll]
  );

  // Paginated mode result
  const paginatedResult = useMemo(
    () => ({
      templates,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      error,
    }),
    [templates, isLoading, isLoadingMore, hasMore, loadMore, error]
  );

  // Return appropriate type based on mode
  return (mode === 'paginated' ? paginatedResult : allResult) as UseWorkoutTemplatesResult;
}
