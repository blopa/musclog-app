/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { useWorkoutTemplates } from '@/hooks/useWorkoutTemplates';

type FakeTemplate = { id: string; name: string };
let subscribeNext: (val: FakeTemplate[]) => void;
let unsubscribeFn: jest.Mock;

const createMockObservable = (initialEmit: FakeTemplate[]) => ({
  subscribe: (handlers: { next: (v: FakeTemplate[]) => void; error?: (e: unknown) => void }) => {
    subscribeNext = handlers.next;
    handlers.next(initialEmit);
    unsubscribeFn = jest.fn();
    return { unsubscribe: unsubscribeFn };
  },
});

const mockQuery = {
  observe: jest.fn(),
};

const mockCollection = {
  query: jest.fn(() => mockQuery),
};

jest.mock('../../database/database-instance', () => ({
  database: {
    get: jest.fn(() => mockCollection),
  },
}));

jest.mock('../../database/services/WorkoutTemplateService', () => ({
  WorkoutTemplateService: {
    getAllTemplatesWithMetadata: jest.fn(),
    getTemplatesWithMetadataPaginated: jest.fn(),
  },
}));

describe('useWorkoutTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.observe.mockReturnValue(createMockObservable([]));
    (WorkoutTemplateService.getAllTemplatesWithMetadata as jest.Mock).mockResolvedValue([]);
    (WorkoutTemplateService.getTemplatesWithMetadataPaginated as jest.Mock).mockResolvedValue([]);
  });

  it('returns empty templates and isLoading false after first emit when no templates', async () => {
    const { result } = renderHook(() => useWorkoutTemplates());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.templates).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('returns templates with metadata when available', async () => {
    const mockTemplates = [
      {
        id: '1',
        name: 'Push Day',
        exerciseCount: 5,
        lastCompleted: 'Today',
        lastCompletedTimestamp: Date.now(),
        duration: '45m',
      },
      {
        id: '2',
        name: 'Pull Day',
        exerciseCount: 6,
        lastCompleted: 'Yesterday',
        lastCompletedTimestamp: Date.now() - 86400000,
        duration: '50m',
      },
    ];

    (WorkoutTemplateService.getAllTemplatesWithMetadata as jest.Mock).mockResolvedValue(
      mockTemplates
    );

    mockQuery.observe.mockReturnValue(createMockObservable([{ id: '1', name: 'Push Day' }]));

    const { result } = renderHook(() => useWorkoutTemplates());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.templates).toEqual(mockTemplates);
    expect(result.current.error).toBe(null);
    expect(WorkoutTemplateService.getAllTemplatesWithMetadata).toHaveBeenCalled();
  });

  it('handles error by setting error state and empty templates', async () => {
    const errorMessage = 'Failed to fetch templates';
    (WorkoutTemplateService.getAllTemplatesWithMetadata as jest.Mock).mockRejectedValue(
      new Error(errorMessage)
    );

    const { result } = renderHook(() => useWorkoutTemplates());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.templates).toEqual([]);
    expect(result.current.error).toBe(errorMessage);
  });

  it('handles subscription error by setting error state', async () => {
    let errorHandler: (e: unknown) => void;
    const mockObs = {
      subscribe: (handlers: {
        next: (v: FakeTemplate[]) => void;
        error?: (e: unknown) => void;
      }) => {
        subscribeNext = handlers.next;
        errorHandler = handlers.error!;
        // Emit error synchronously
        setTimeout(() => errorHandler(new Error('db error')), 0);
        unsubscribeFn = jest.fn();
        return { unsubscribe: unsubscribeFn };
      },
    };
    mockQuery.observe.mockReturnValue(mockObs);

    const { result } = renderHook(() => useWorkoutTemplates());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.templates).toEqual([]);
    expect(result.current.error).toBe('db error');
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useWorkoutTemplates());

    await waitFor(() => {
      expect(unsubscribeFn).toBeDefined();
    });

    unmount();
    expect(unsubscribeFn).toHaveBeenCalled();
  });

  it('updates templates when observable emits new data', async () => {
    const initialTemplates = [{ id: '1', name: 'Push Day' }];
    const updatedTemplates = [
      {
        id: '1',
        name: 'Push Day',
        exerciseCount: 5,
        lastCompleted: 'Today',
      },
      {
        id: '2',
        name: 'Pull Day',
        exerciseCount: 6,
        lastCompleted: 'Yesterday',
      },
    ];

    (WorkoutTemplateService.getAllTemplatesWithMetadata as jest.Mock)
      .mockResolvedValueOnce([{ id: '1', name: 'Push Day', exerciseCount: 5 }])
      .mockResolvedValueOnce(updatedTemplates);

    mockQuery.observe.mockReturnValue(createMockObservable(initialTemplates));

    const { result } = renderHook(() => useWorkoutTemplates());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Emit new data
    act(() => {
      subscribeNext([
        { id: '1', name: 'Push Day' },
        { id: '2', name: 'Pull Day' },
      ]);
    });

    await waitFor(() => {
      expect(result.current.templates).toEqual(updatedTemplates);
    });

    expect(WorkoutTemplateService.getAllTemplatesWithMetadata).toHaveBeenCalledTimes(2);
  });

  describe('paginated mode', () => {
    it('returns paginated templates with loadMore functionality', async () => {
      const initialTemplates = [
        {
          id: '1',
          name: 'Push Day',
          exerciseCount: 5,
          lastCompleted: 'Today',
          lastCompletedTimestamp: Date.now(),
          duration: '45m',
        },
        {
          id: '2',
          name: 'Pull Day',
          exerciseCount: 6,
          lastCompleted: 'Yesterday',
          lastCompletedTimestamp: Date.now() - 86400000,
          duration: '50m',
        },
      ];

      const moreTemplates = [
        {
          id: '3',
          name: 'Leg Day',
          exerciseCount: 7,
          lastCompleted: '2 days ago',
          lastCompletedTimestamp: Date.now() - 172800000,
          duration: '60m',
        },
      ];

      (WorkoutTemplateService.getTemplatesWithMetadataPaginated as jest.Mock)
        .mockResolvedValueOnce(initialTemplates)
        .mockResolvedValueOnce(moreTemplates) // Check for hasMore
        .mockResolvedValueOnce(moreTemplates); // loadMore call

      mockQuery.observe.mockReturnValue(createMockObservable([{ id: '1', name: 'Push Day' }]));

      const { result } = renderHook(() =>
        useWorkoutTemplates({ mode: 'paginated', initialLimit: 2, batchSize: 1 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates).toEqual(initialTemplates);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.isLoadingMore).toBe(false);
      expect(result.current.error).toBe(null);

      // Test loadMore
      await act(async () => {
        await result.current.loadMore();
      });

      await waitFor(() => {
        expect(result.current.isLoadingMore).toBe(false);
      });

      expect(result.current.templates).toHaveLength(3);
      expect(result.current.templates[2]).toEqual(moreTemplates[0]);
    });

    it('handles getAll flag to fetch all templates without pagination', async () => {
      const allTemplates = [
        {
          id: '1',
          name: 'Push Day',
          exerciseCount: 5,
        },
        {
          id: '2',
          name: 'Pull Day',
          exerciseCount: 6,
        },
        {
          id: '3',
          name: 'Leg Day',
          exerciseCount: 7,
        },
      ];

      (WorkoutTemplateService.getTemplatesWithMetadataPaginated as jest.Mock).mockResolvedValue(
        allTemplates
      );

      mockQuery.observe.mockReturnValue(createMockObservable([{ id: '1', name: 'Push Day' }]));

      const { result } = renderHook(() => useWorkoutTemplates({ mode: 'paginated', getAll: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates).toEqual(allTemplates);
      expect(result.current.hasMore).toBe(false);
      expect(WorkoutTemplateService.getTemplatesWithMetadataPaginated).toHaveBeenCalledWith();
    });

    it('handles error in paginated mode', async () => {
      const errorMessage = 'Failed to fetch templates';
      (WorkoutTemplateService.getTemplatesWithMetadataPaginated as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      mockQuery.observe.mockReturnValue(createMockObservable([{ id: '1', name: 'Push Day' }]));

      const { result } = renderHook(() => useWorkoutTemplates({ mode: 'paginated' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates).toEqual([]);
      expect(result.current.error).toBe(errorMessage);
    });

    it('does not load more when getAll is true', async () => {
      const allTemplates = [
        {
          id: '1',
          name: 'Push Day',
          exerciseCount: 5,
        },
      ];

      (WorkoutTemplateService.getTemplatesWithMetadataPaginated as jest.Mock).mockResolvedValue(
        allTemplates
      );

      mockQuery.observe.mockReturnValue(createMockObservable([{ id: '1', name: 'Push Day' }]));

      const { result } = renderHook(() => useWorkoutTemplates({ mode: 'paginated', getAll: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = (
        WorkoutTemplateService.getTemplatesWithMetadataPaginated as jest.Mock
      ).mock.calls.length;

      // Try to load more
      await act(async () => {
        await result.current.loadMore();
      });

      // Should not make additional calls
      expect(WorkoutTemplateService.getTemplatesWithMetadataPaginated).toHaveBeenCalledTimes(
        initialCallCount
      );
    });
  });
});
