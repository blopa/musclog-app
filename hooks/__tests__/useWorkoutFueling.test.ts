/**
 * @jest-environment jsdom
 */

// Mock these BEFORE any imports
jest.mock('react-native-health-connect', () => ({
  RecordingMethod: {
    RECORDING_METHOD_MANUAL_ENTRY: 1,
  },
}));

jest.mock('../../database/database-instance', () => ({
  database: {
    get: jest.fn(),
  },
}));

jest.mock('../../database/services/NutritionService', () => ({
  NutritionService: {
    getNutritionLogsForDate: jest.fn(),
  },
}));

jest.mock('../../database/services/UserMetricService', () => ({
  UserMetricService: {
    getLatest: jest.fn(),
  },
}));

import { renderHook, waitFor } from '@testing-library/react';

import { NutritionService } from '../../database/services/NutritionService';
import { UserMetricService } from '../../database/services/UserMetricService';
import { useWorkoutFueling } from '../useWorkoutFueling';

// Mock the services
jest.mock('../../database/services/NutritionService');
jest.mock('../../database/services/UserMetricService');

describe('useWorkoutFueling', () => {
  const mockUserWeight = 70;
  const mockWeightMetric = {
    getDecrypted: jest.fn().mockResolvedValue({ value: mockUserWeight, unit: 'kg' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (UserMetricService.getLatest as jest.Mock).mockResolvedValue(mockWeightMetric);
  });

  it('should return loading status initially', async () => {
    (NutritionService.getNutritionLogsForDate as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useWorkoutFueling());

    expect(result.current.status).toBe('loading');
    expect(result.current.isLoading).toBe(true);
  });

  it('should return low status when carbs are below 1g/kg (Afternoon)', async () => {
    const afternoonStart = new Date();
    afternoonStart.setHours(14, 0, 0, 0);

    // Mock 30g carbs today (threshold is 70g)
    (NutritionService.getNutritionLogsForDate as jest.Mock).mockImplementation((date) => {
      return Promise.resolve([
        {
          getNutrients: () => Promise.resolve({ carbs: 30 }),
        },
      ]);
    });

    const { result } = renderHook(() => useWorkoutFueling(afternoonStart.getTime()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.status).toBe('low');
  });

  it('should return optimal status when carbs are above 1g/kg (Afternoon)', async () => {
    const afternoonStart = new Date();
    afternoonStart.setHours(14, 0, 0, 0);

    // Mock 80g carbs today (threshold is 70g)
    (NutritionService.getNutritionLogsForDate as jest.Mock).mockImplementation((date) => {
      return Promise.resolve([
        {
          getNutrients: () => Promise.resolve({ carbs: 80 }),
        },
      ]);
    });

    const { result } = renderHook(() => useWorkoutFueling(afternoonStart.getTime()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.status).toBe('optimal');
  });

  it('should return low status when carbs are below 1g/kg (Morning)', async () => {
    const morningStart = new Date();
    morningStart.setHours(8, 0, 0, 0);

    // Threshold is 70g
    (NutritionService.getNutritionLogsForDate as jest.Mock).mockImplementation((date) => {
      const d = new Date(date);
      const today = new Date();
      today.setHours(0,0,0,0);

      if (d.getTime() < today.getTime()) {
        // Yesterday's dinner
        return Promise.resolve([
          { type: 'dinner', getNutrients: () => Promise.resolve({ carbs: 20 }) },
          { type: 'snack', getNutrients: () => Promise.resolve({ carbs: 50 }) }, // should be ignored
        ]);
      } else {
        // Today's breakfast
        return Promise.resolve([
          { type: 'breakfast', getNutrients: () => Promise.resolve({ carbs: 10 }) },
        ]);
      }
    });

    const { result } = renderHook(() => useWorkoutFueling(morningStart.getTime()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Total fueling carbs = 20 (dinner) + 10 (breakfast) = 30 < 70
    expect(result.current.status).toBe('low');
  });

  it('should return optimal status when carbs are above 1g/kg (Morning)', async () => {
    const morningStart = new Date();
    morningStart.setHours(8, 0, 0, 0);

    // Threshold is 70g
    (NutritionService.getNutritionLogsForDate as jest.Mock).mockImplementation((date) => {
      const d = new Date(date);
      const today = new Date();
      today.setHours(0,0,0,0);

      if (d.getTime() < today.getTime()) {
        // Yesterday's dinner
        return Promise.resolve([
          { type: 'dinner', getNutrients: () => Promise.resolve({ carbs: 50 }) },
        ]);
      } else {
        // Today's breakfast
        return Promise.resolve([
          { type: 'breakfast', getNutrients: () => Promise.resolve({ carbs: 30 }) },
        ]);
      }
    });

    const { result } = renderHook(() => useWorkoutFueling(morningStart.getTime()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Total fueling carbs = 50 (dinner) + 30 (breakfast) = 80 > 70
    expect(result.current.status).toBe('optimal');
  });
});
