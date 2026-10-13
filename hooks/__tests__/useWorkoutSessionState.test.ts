/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { of } from 'rxjs';

import { database } from '@/database';
import { WorkoutService } from '@/database/services/WorkoutService';
import { useWorkoutSessionState } from '@/hooks/useWorkoutSessionState';

jest.mock('@/database', () => ({
  database: {
    get: jest.fn(),
  },
}));

jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: {
    buildEnrichedSetsFromRecords: jest.fn(),
  },
}));

jest.mock('@/utils/workoutSupersetOrder', () => ({
  getEffectiveOrder: jest.fn((sets) => sets),
  getFirstUnloggedInEffectiveOrder: jest.fn(),
  getNextSetInEffectiveOrder: jest.fn(),
}));

const mockObserve = (data: any) => ({
  observe: () => of(data),
  observeWithColumns: () => of(data),
});

describe('useWorkoutSessionState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Between-sets re-targeting is decided and persisted by `WorkoutSessionService.saveSet` (see
   * `WorkoutSessionService.test.ts`). The session reads the sets exactly as stored, so a planned set
   * whose previous set was performed keeps its stored numbers here — recomputing them would give the
   * screen a second, divergent opinion about what the next set should be.
   */
  it('exposes the current set exactly as stored, without recomputing its targets', async () => {
    const mockSets = [
      {
        id: 'set-1',
        exerciseId: 'ex-1',
        logExerciseId: 'le-1',
        weight: 12,
        reps: 11,
        completionStatus: 'performed',
        repsInReserve: 0,
        setOrder: 1,
      },
      {
        id: 'set-2',
        exerciseId: 'ex-1',
        logExerciseId: 'le-1',
        weight: 18,
        reps: 14,
        completionStatus: 'planned',
        repsInReserve: 2,
        setOrder: 2,
        adjustment: { cause: 'target_rir', field: 'reps', from: 14, to: 9 },
      },
    ];
    (WorkoutService.buildEnrichedSetsFromRecords as jest.Mock).mockReturnValue(mockSets);
    const workoutUtils = require('@/utils/workoutSupersetOrder');
    workoutUtils.getFirstUnloggedInEffectiveOrder.mockReturnValue(mockSets[1]);
    workoutUtils.getEffectiveOrder.mockReturnValue(mockSets);
    (database.get as jest.Mock).mockImplementation((table) => {
      if (table === 'workout_logs') {
        return { query: () => mockObserve([{ id: 'log-1' }]) };
      }
      if (table === 'workout_log_exercises') {
        return { query: () => mockObserve([{ id: 'le-1', exerciseId: 'ex-1' }]) };
      }
      if (table === 'workout_log_sets') {
        return { query: () => ({ observeWithColumns: () => of(mockSets) }) };
      }
      return { query: () => mockObserve([{ id: 'ex-1', equipmentType: 'dumbbell' }]) };
    });

    const { result } = renderHook(() => useWorkoutSessionState('log-1'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentSet?.id).toBe('set-2');
    expect(result.current.currentSet?.weight).toBe(18);
    expect(result.current.currentSet?.reps).toBe(14);
    expect(result.current.currentSet?.adjustment).toMatchObject({ cause: 'target_rir' });
    expect(result.current.previousSet).toMatchObject({ weight: 12, reps: 11 });
  });
});
