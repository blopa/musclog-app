/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { of } from 'rxjs';

import { database } from '@/database';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { useWorkoutSessionState } from '@/hooks/useWorkoutSessionState';

// Mock dependencies
jest.mock('@/database', () => ({
  database: {
    get: jest.fn(),
  },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getProgressionMode: jest.fn(),
  },
}));

jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: {
    getUserBodyWeightKgForVolume: jest.fn(),
  },
}));

jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: {
    buildEnrichedSetsFromRecords: jest.fn(),
  },
}));

// The session reads the active gym through settings context, which this test does not mount.
let mockActiveGym: any = null;
jest.mock('@/hooks/useActiveGym', () => ({
  useActiveGym: () => ({ gym: mockActiveGym, gyms: [], isLoading: false }),
}));

jest.mock('@/utils/workoutSupersetOrder', () => ({
  getEffectiveOrder: jest.fn((sets) => sets),
  getFirstUnloggedInEffectiveOrder: jest.fn(),
  getNextSetInEffectiveOrder: jest.fn(),
}));

describe('useWorkoutSessionState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveGym = null;
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
        completionStatus: 'performed',
        difficultyLevel: 8,
        repsInReserve: 0,
        setOrder: 1,
      },
      {
        id: 'set-2',
        exerciseId: 'ex-1',
        weight: 18,
        reps: 14,
        completionStatus: 'planned',
        difficultyLevel: undefined,
        repsInReserve: 2,
        setOrder: 2,
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
    // The set carries the reason for the change, so the session can explain it rather than
    // silently rewriting the user's planned numbers.
    expect(result.current.currentSet?.adjustment).toMatchObject({
      cause: 'target_rir',
      field: 'reps',
      from: 14,
      to: 9,
      targetRepsInReserve: 2,
    });
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
        completionStatus: 'performed',
        difficultyLevel: 8,
        repsInReserve: 2,
        setOrder: 1,
      },
      {
        id: 'set-2',
        exerciseId: 'ex-1',
        weight: 18,
        reps: 11, // Planned for 11 reps
        completionStatus: 'planned',
        difficultyLevel: undefined,
        repsInReserve: 2, // Explicit target: 0 would mean "no target named" and take the default
        setOrder: 2,
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

    // The previous set (12 kg x 11 @ 2 RIR) and the plan (11 reps @ 2 RIR) are the same total
    // effort, so the target-RIR step has nothing left to change once the load carries over.
    expect(result.current.currentSet?.id).toBe('set-2');
    expect(result.current.currentSet?.weight).toBe(12);
    // 12 because it carried over 12 from the last set, and 12 is already the weight that holds
    // 11 reps at 2 RIR. Only the carry-over moved the number, so that — not a target-RIR
    // recalculation — is what the session reports.
    expect(result.current.currentSet?.adjustment).toMatchObject({
      cause: 'carry_over',
      field: 'weight',
      from: 18,
      to: 12,
    });
  });

  describe('with an active gym', () => {
    const commercialGym = {
      id: 'gym-1',
      name: 'Gym',
      barWeightKg: 20,
      plates: [
        { weightKg: 20, count: 20 },
        { weightKg: 10, count: 20 },
        { weightKg: 5, count: 20 },
        { weightKg: 2.5, count: 20 },
        { weightKg: 1.25, count: 20 },
      ],
      weightIncrementKg: 2.5,
      equipment: ['barbell', 'dumbbell'],
    };

    async function renderRetargetedBarbellSet() {
      (SettingsService.getProgressionMode as jest.Mock).mockResolvedValue('weight_first');
      const workoutLogId = 'log-gym';
      const mockObserve = (data: any) => ({
        observe: () => of(data),
        observeWithColumns: () => of(data),
      });
      const mockSets = [
        {
          id: 'set-1',
          exerciseId: 'ex-1',
          weight: 77,
          reps: 10,
          completionStatus: 'performed',
          difficultyLevel: 9,
          repsInReserve: 0,
          setOrder: 1,
        },
        {
          id: 'set-2',
          exerciseId: 'ex-1',
          weight: 77,
          reps: 6,
          completionStatus: 'planned',
          difficultyLevel: undefined,
          repsInReserve: 2,
          setOrder: 2,
        },
      ];
      // The session mutates the set it re-targets, and the real service builds fresh sets on every
      // emission. Returning the same objects would let a second pipeline run (after the async
      // progression mode loads) see values the first run already adjusted.
      (WorkoutService.buildEnrichedSetsFromRecords as jest.Mock).mockImplementation(() =>
        mockSets.map((set) => ({ ...set }))
      );
      const workoutUtils = require('@/utils/workoutSupersetOrder');
      workoutUtils.getFirstUnloggedInEffectiveOrder.mockImplementation((sets: any[]) =>
        sets.find((set) => set.id === 'set-2')
      );
      workoutUtils.getEffectiveOrder.mockImplementation((sets: any[]) => sets);
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
          return { query: () => mockObserve([{ id: 'ex-1', equipmentType: 'barbell' }]) };
        }
        return { query: () => mockObserve([]) };
      });

      const { result } = renderHook(() => useWorkoutSessionState(workoutLogId));
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      // The progression mode loads asynchronously and re-runs the pipeline; wait for weight_first.
      await waitFor(() => {
        expect(result.current.currentSet?.adjustment?.field).toBe('weight');
      });
      return result.current.currentSet;
    }

    it('keeps the whole-kilogram rounding when no gym is selected', async () => {
      const set = await renderRetargetedBarbellSet();

      expect(set?.adjustment).toMatchObject({ cause: 'target_rir', field: 'weight' });
      expect(Number.isInteger(set?.weight)).toBe(true);
    });

    it('snaps a re-targeted weight to a load the bar can actually be set to', async () => {
      mockActiveGym = commercialGym;

      const set = await renderRetargetedBarbellSet();

      // 20 kg bar + pairs of plates down to 1.25 kg: every loadable weight is a multiple of 2.5.
      expect(set?.adjustment).toMatchObject({ cause: 'target_rir', field: 'weight' });
      expect((set?.weight ?? 0) % 2.5).toBe(0);
      expect(set?.adjustment?.to).toBe(set?.weight);
    });
  });

  describe('warm-up sets', () => {
    async function renderSession(mockSets: any[], currentId: string) {
      (SettingsService.getProgressionMode as jest.Mock).mockResolvedValue('weight_first');
      const workoutLogId = 'log-warmup';
      const mockObserve = (data: any) => ({
        observe: () => of(data),
        observeWithColumns: () => of(data),
      });
      (WorkoutService.buildEnrichedSetsFromRecords as jest.Mock).mockImplementation(() =>
        mockSets.map((set) => ({ ...set }))
      );
      const workoutUtils = require('@/utils/workoutSupersetOrder');
      workoutUtils.getFirstUnloggedInEffectiveOrder.mockImplementation((sets: any[]) =>
        sets.find((set) => set.id === currentId)
      );
      workoutUtils.getEffectiveOrder.mockImplementation((sets: any[]) => sets);
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
          return { query: () => mockObserve([{ id: 'ex-1', equipmentType: 'barbell' }]) };
        }
        return { query: () => mockObserve([]) };
      });

      const { result } = renderHook(() => useWorkoutSessionState(workoutLogId));
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      // Let the asynchronously loaded progression mode re-run the pipeline before reading.
      await new Promise((resolve) => setTimeout(resolve, 50));
      return result.current;
    }

    const base = {
      exerciseId: 'ex-1',
      difficultyLevel: undefined,
      repsInReserve: 2,
    };

    it('does not re-target a working set from the warm-up before it', async () => {
      const state = await renderSession(
        [
          // A light warm-up that was performed…
          {
            ...base,
            id: 'warm',
            weight: 40,
            reps: 8,
            completionStatus: 'performed',
            setType: 'warmup',
            setOrder: 1,
          },
          // …must not drag the first working set (planned at 100 × 5) down to what it implies.
          {
            ...base,
            id: 'work',
            weight: 100,
            reps: 5,
            completionStatus: 'planned',
            setType: 'normal',
            setOrder: 2,
          },
        ],
        'work'
      );

      expect(state.currentSet?.id).toBe('work');
      expect(state.currentSet?.weight).toBe(100);
      expect(state.currentSet?.reps).toBe(5);
      expect(state.currentSet?.adjustment).toBeUndefined();
    });

    it('does not re-target a planned warm-up, which has no reps-in-reserve target to hold', async () => {
      const state = await renderSession(
        [
          {
            ...base,
            id: 'warm-1',
            weight: 40,
            reps: 8,
            completionStatus: 'performed',
            setType: 'warmup',
            setOrder: 1,
          },
          {
            ...base,
            id: 'warm-2',
            weight: 60,
            reps: 5,
            completionStatus: 'planned',
            setType: 'warmup',
            setOrder: 2,
          },
        ],
        'warm-2'
      );

      expect(state.currentSet?.weight).toBe(60);
      expect(state.currentSet?.reps).toBe(5);
      expect(state.currentSet?.adjustment).toBeUndefined();
    });

    it('still re-targets a working set from the working set before it', async () => {
      const state = await renderSession(
        [
          {
            ...base,
            id: 'warm',
            weight: 40,
            reps: 8,
            completionStatus: 'performed',
            setType: 'warmup',
            setOrder: 1,
          },
          {
            ...base,
            id: 'work-1',
            weight: 77,
            reps: 10,
            completionStatus: 'performed',
            setType: 'normal',
            repsInReserve: 0,
            setOrder: 2,
          },
          {
            ...base,
            id: 'work-2',
            weight: 77,
            reps: 6,
            completionStatus: 'planned',
            setType: 'normal',
            setOrder: 3,
          },
        ],
        'work-2'
      );

      expect(state.currentSet?.adjustment).toMatchObject({ cause: 'target_rir', field: 'weight' });
    });
  });
});
