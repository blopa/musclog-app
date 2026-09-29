import { renderHook, waitFor } from '@testing-library/react';

import { database } from '@/database';
import { useDailySteps } from '../useDailySteps';
import { localDayHalfOpenRange } from '@/utils/calendarDate';

jest.mock('@/database', () => ({
  database: {
    collections: {
      get: jest.fn(),
    },
  },
}));

jest.mock('@/utils/calendarDate', () => ({
  localDayHalfOpenRange: jest.fn(),
}));

describe('useDailySteps', () => {
  it('returns null steps when no records are found', async () => {
    const mockObserve = jest.fn().mockReturnValue({
      subscribe: (callback: any) => {
        callback([]);
        return { unsubscribe: jest.fn() };
      },
    });

    (database.collections.get as jest.Mock).mockReturnValue({
      query: jest.fn().mockReturnValue({ observe: mockObserve }),
    });

    (localDayHalfOpenRange as jest.Mock).mockReturnValue({
      start: 0,
      nextStart: 86400000,
    });

    const date = new Date('2023-10-10');
    const { result } = renderHook(() => useDailySteps(date));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.steps).toBe(null);
  });

  it('returns steps when a record is found', async () => {
    const mockRecord = {
      getDecrypted: jest.fn().mockResolvedValue({ value: 5000 }),
    };

    const mockObserve = jest.fn().mockReturnValue({
      subscribe: (callback: any) => {
        callback([mockRecord]);
        return { unsubscribe: jest.fn() };
      },
    });

    (database.collections.get as jest.Mock).mockReturnValue({
      query: jest.fn().mockReturnValue({ observe: mockObserve }),
    });

    (localDayHalfOpenRange as jest.Mock).mockReturnValue({
      start: 0,
      nextStart: 86400000,
    });

    const date = new Date('2023-10-10');
    const { result } = renderHook(() => useDailySteps(date));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.steps).toBe(5000);
  });
});
