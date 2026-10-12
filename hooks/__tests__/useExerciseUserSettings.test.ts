/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';

import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';

let mockAccountUnits: 'metric' | 'imperial' = 'metric';
let mockGymUnit: 'kg' | 'lbs' | undefined;
let mockRows: { exerciseId: string; weightUnit?: string; note?: string }[] = [];

jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ units: mockAccountUnits }),
}));
jest.mock('@/hooks/useActiveGym', () => ({
  useActiveGym: () => ({
    gym: mockGymUnit === undefined ? null : { id: 'g', weightUnit: mockGymUnit },
    gyms: [],
    isLoading: false,
  }),
}));
jest.mock('@/database/services/ExerciseUserSettingsService', () => ({
  ...jest.requireActual('@/database/services/ExerciseUserSettingsService'),
  ExerciseUserSettingsService: {
    settingsQuery: () => ({ observeWithColumns: () => require('rxjs').of(mockRows) }),
  },
}));
jest.mock('@/database/database-instance', () => ({ database: {} }));

async function render() {
  const { result } = renderHook(() => useExerciseUserSettings());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result.current;
}

describe('useExerciseUserSettings().unitsFor', () => {
  beforeEach(() => {
    mockAccountUnits = 'metric';
    mockGymUnit = undefined;
    mockRows = [{ exerciseId: 'bench', weightUnit: 'lbs' }];
  });

  it("uses the exercise's own unit first", async () => {
    mockGymUnit = 'kg';
    const { unitsFor } = await render();

    expect(unitsFor('bench')).toBe('imperial');
  });

  it("falls back to the active gym's unit, then the account's", async () => {
    mockGymUnit = 'lbs';
    expect((await render()).unitsFor('squat')).toBe('imperial');

    mockGymUnit = undefined;
    expect((await render()).unitsFor('squat')).toBe('metric');
  });

  it('applies the gym to every screen without the screen passing it', async () => {
    // History, past-workout detail and the edit modal used to call `unitsFor(id, account)` and
    // silently skip the gym the live session honoured, showing one set in two units.
    mockGymUnit = 'lbs';
    const { unitsFor } = await render();

    expect(unitsFor(undefined)).toBe('imperial');
  });

  it('ignores a unit this build does not understand', async () => {
    mockRows = [{ exerciseId: 'bench', weightUnit: 'stone' }];
    mockAccountUnits = 'imperial';

    expect((await render()).unitsFor('bench')).toBe('imperial');
  });
});
