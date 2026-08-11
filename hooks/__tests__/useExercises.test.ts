/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { ExerciseService } from '@/database/services';
import { useExercises } from '@/hooks/useExercises';

jest.mock('@nozbe/watermelondb', () => ({ Q: {} }));

jest.mock('@/database', () => ({
  database: { get: jest.fn() },
}));

jest.mock('@/database/services', () => ({
  ExerciseService: {
    getAllExercises: jest.fn(),
    getExercisesPaginatedFiltered: jest.fn(),
  },
}));

jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

const getAllExercises = ExerciseService.getAllExercises as jest.Mock;
const getExercisesPaginatedFiltered = ExerciseService.getExercisesPaginatedFiltered as jest.Mock;

const exercises = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}` }));

describe('useExercises list pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches bounded database pages and uses one lookahead row for hasMore', async () => {
    getExercisesPaginatedFiltered
      .mockResolvedValueOnce(exercises('first', 41))
      .mockResolvedValueOnce(exercises('second', 11));

    const { result } = renderHook(() =>
      useExercises({
        batchSize: 40,
        enableReactivity: false,
        initialLimit: 40,
        mode: 'list',
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.exercises).toHaveLength(40);
    expect(result.current.hasMore).toBe(true);
    expect(getExercisesPaginatedFiltered).toHaveBeenNthCalledWith(1, 41, 0, {
      muscleGroup: undefined,
      searchTerm: undefined,
    });
    expect(getAllExercises).not.toHaveBeenCalled();

    await act(async () => result.current.loadMore());

    expect(result.current.exercises).toHaveLength(51);
    expect(result.current.hasMore).toBe(false);
    expect(getExercisesPaginatedFiltered).toHaveBeenNthCalledWith(2, 41, 40, {
      muscleGroup: undefined,
      searchTerm: undefined,
    });
    expect(getAllExercises).not.toHaveBeenCalled();
  });
});
