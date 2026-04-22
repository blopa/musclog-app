/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { of } from 'rxjs';

import { database } from '@/database';
import { SettingsService, UserMetricService, WorkoutService } from '@/database/services';
import { useWorkoutSessionState } from '@/hooks/useWorkoutSessionState';

// Mock dependencies
jest.mock('@/database', () => ({
  database: {
    get: jest.fn(),
  },
}));

jest.mock('@/database/services', () => ({
  SettingsService: {
    getProgressionMode: jest.fn(),
  },
  UserMetricService: {
    getUserBodyWeightKgForVolume: jest.fn(),
  },
  WorkoutService: {
    buildEnrichedSetsFromRecords: jest.fn(),
  },
}));

jest.mock('@/utils/workoutSupersetOrder', () => ({
  getEffectiveOrder: jest.fn((sets) => sets),
  getFirstUnloggedInEffectiveOrder: jest.fn(),
  getNextSetInEffectiveOrder: jest.fn(),
}));

describe('useWorkoutSessionState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (UserMetricService.getUserBodyWeightKgForVolume as jest.Mock).mockResolvedValue(70);
    (SettingsService.getProgressionMode as jest.Mock).mockResolvedValue('reps_first');
  });

  it('should reproduce the bug: suggests 1 rep when weight is much higher than actual', async () => {
    const workoutLogId = 'log-1';

    // Mock database queries to return observables
    const mockObserve = (data: any) => ({
      observe: () => of(data),
      observeWithColumns: () => of(data),
    });

    (database.get as jest.Mock).mockImplementation((table) => ({
      query: () => mockObserve(table === 'workout_logs' ? [{ id: workoutLogId }] : []),
    }));

    // Mock WorkoutService.buildEnrichedSetsFromRecords to return our test scenario
    // Set 1: Completed at 12kg x 11 reps, difficulty 8 (logged)
    // Set 2: Planned at 18kg x 14 reps, difficulty 0 (unlogged)
    const mockSets = [
      {
        id: 'set-1',
        exerciseId: 'ex-1',
        weight: 12,
        reps: 11,
        difficultyLevel: 8,
        repsInReserve: 0,
        setOrder: 1,
        isSkipped: false,
      },
      {
        id: 'set-2',
        exerciseId: 'ex-1',
        weight: 18,
        reps: 14,
        difficultyLevel: 0,
        repsInReserve: 2,
        setOrder: 2,
        isSkipped: false,
      },
    ];

    (WorkoutService.buildEnrichedSetsFromRecords as jest.Mock).mockReturnValue(mockSets);

    const workoutUtils = require('@/utils/workoutSupersetOrder');
    workoutUtils.getFirstUnloggedInEffectiveOrder.mockReturnValue(mockSets[1]);
    workoutUtils.getEffectiveOrder.mockReturnValue(mockSets);

    // Mock exercise
    (database.get as jest.Mock).mockImplementation((table) => {
      if (table === 'workout_logs') {
        return { query: () => mockObserve([{ id: workoutLogId }]) };
      }
      if (table === 'workout_log_exercises') {
        return { query: () => mockObserve([{ id: 'le-1', exerciseId: 'ex-1' }]) };
      }
      if (table === 'workout_log_sets') {
        return { query: () => ({ observeWithColumns: () => of(mockSets) }) };
      }
      if (table === 'exercises') {
        return { query: () => mockObserve([{ id: 'ex-1', equipmentType: 'dumbbell' }]) };
      }
      return { query: () => mockObserve([]) };
    });

    const { result } = renderHook(() => useWorkoutSessionState(workoutLogId));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify currentSet (which is Set 2) has adjusted reps and carried over weight
    // In reps_first mode, weight should carry over from 12kg, and reps should be calculated based on 1RM of (12kg x 11 reps)
    // 1RM of 12kg x 11 reps is approx 16.4kg (using Epley: 12 * (1 + 11/30) = 16.4)
    // Target RIR is 2.
    // Weight = 12kg.
    // 16.4 = 12 * (1 + (reps + 2)/30)
    // 16.4/12 = 1 + (reps + 2)/30
    // 1.3666 = 1 + (reps + 2)/30
    // 0.3666 = (reps + 2)/30
    // 11 = reps + 2
    // reps = 9
    expect(result.current.currentSet?.id).toBe('set-2');
    expect(result.current.currentSet?.weight).toBe(12);
    expect(result.current.currentSet?.reps).toBe(9);
    expect(result.current.currentSet?.isAutoAdjusted).toBe(true);
  });

  it('should adjust weight in weight_first mode after carrying over manual adjustment', async () => {
    (SettingsService.getProgressionMode as jest.Mock).mockResolvedValue('weight_first');
    const workoutLogId = 'log-2';

    const mockObserve = (data: any) => ({
      observe: () => of(data),
      observeWithColumns: () => of(data),
    });

    const mockSets = [
      {
        id: 'set-1',
        exerciseId: 'ex-1',
        weight: 12,
        reps: 11,
        difficultyLevel: 8,
        repsInReserve: 0,
        setOrder: 1,
        isSkipped: false,
      },
      {
        id: 'set-2',
        exerciseId: 'ex-1',
        weight: 18,
        reps: 11, // Planned for 11 reps
        difficultyLevel: 0,
        repsInReserve: 0, // Target 0 RIR
        setOrder: 2,
        isSkipped: false,
      },
    ];

    (WorkoutService.buildEnrichedSetsFromRecords as jest.Mock).mockReturnValue(mockSets);

    const workoutUtils = require('@/utils/workoutSupersetOrder');
    workoutUtils.getFirstUnloggedInEffectiveOrder.mockReturnValue(mockSets[1]);
    workoutUtils.getEffectiveOrder.mockReturnValue(mockSets);

    (database.get as jest.Mock).mockImplementation((table) => {
      if (table === 'workout_logs') {
        return { query: () => mockObserve([{ id: workoutLogId }]) };
      }
      if (table === 'workout_log_exercises') {
        return { query: () => mockObserve([{ id: 'le-1', exerciseId: 'ex-1' }]) };
      }
      if (table === 'workout_log_sets') {
        return { query: () => ({ observeWithColumns: () => of(mockSets) }) };
      }
      if (table === 'exercises') {
        return { query: () => mockObserve([{ id: 'ex-1', equipmentType: 'dumbbell' }]) };
      }
      return { query: () => mockObserve([]) };
    });

    const { result } = renderHook(() => useWorkoutSessionState(workoutLogId));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // 1RM of 12kg x 11 reps is approx 16.4kg.
    // Target RIR is 0. Target Reps is 11.
    // Weight = 1RM / (1 + (reps + RIR)/30) = 16.4 / (1 + 11/30) = 16.4 / 1.3666 = 12kg.
    expect(result.current.currentSet?.id).toBe('set-2');
    expect(result.current.currentSet?.weight).toBe(12);
    // It should be 12 because it carried over 12 from last set, AND the calculated weight for 11 reps @ 0 RIR is also 12.
  });
});
