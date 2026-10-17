import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import {
  MenstrualCycleProvider,
  useMenstrualCycleContext,
} from '@/components/MenstrualCycleContext';
import type { CycleConfig } from '@/utils/cycle/types';

interface TestCycle {
  id: string;
  isActive: boolean;
  config: string;
}
interface Observer {
  next: (rows: TestCycle[]) => void;
  error: () => void;
}
let mockObserver: Observer;
let mockCycle: TestCycle;
const mockReadConfig = jest.fn<Promise<CycleConfig>, [TestCycle | null]>();
const mockUnsubscribe = jest.fn();
const mockEmptyQuery = {
  observeWithColumns: () => ({
    subscribe: (observer: { next: (rows: never[]) => void }) => {
      observer.next([]);
      return { unsubscribe: mockUnsubscribe };
    },
  }),
};
jest.mock('@/constants/platform', () => ({ isStaticExport: false }));
jest.mock('@/context/SettingsContext', () => ({
  useSettingsContext: () => ({ cycleShowPredictions: true, cycleShowFertility: false }),
}));
jest.mock('@/database/models/MenstrualCycle', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/repositories/CycleRepository', () => ({
  DEFAULT_CYCLE_CONFIG: { fallbackCycleLength: 28, fallbackPeriodDuration: 5 },
  readCycleConfig: (cycle: TestCycle | null) => mockReadConfig(cycle),
  readPeriods: async (rows: never[]) => rows,
  readContexts: async (rows: never[]) => rows,
  readDayLogs: async (rows: never[]) => rows,
  CycleRepository: {
    cycles: () => ({
      observeWithColumns: () => ({
        subscribe: (observer: Observer) => {
          mockObserver = observer;
          observer.next([mockCycle]);
          return { unsubscribe: mockUnsubscribe };
        },
      }),
    }),
    periods: () => mockEmptyQuery,
    contexts: () => mockEmptyQuery,
    dayLogs: () => mockEmptyQuery,
  },
}));
const mockMoods = jest.fn((_enabled: boolean) => ({
  moods: [{ date: 1, value: 3 }],
  isLoading: false,
  error: false,
}));
jest.mock('@/hooks/useCycleMoods', () => ({
  useCycleMoods: (enabled: boolean) => mockMoods(enabled),
}));
jest.mock('@/database/services/CycleTrackingService', () => ({ CycleTrackingService: {} }));
jest.mock('@/database/services/CycleContextService', () => ({ CycleContextService: {} }));
jest.mock('@/database/services/CycleDayLogService', () => ({ CycleDayLogService: {} }));
jest.mock('@/database/services/CyclePeriodService', () => ({ CyclePeriodService: {} }));
jest.mock('@/services/CycleNotificationService', () => ({
  CycleNotificationService: { scheduleMenstrualCycleNotifications: async () => {} },
}));

const initial = { fallbackCycleLength: 28, fallbackPeriodDuration: 5 };
const updated = { fallbackCycleLength: 35, fallbackPeriodDuration: 5 };
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(MenstrualCycleProvider, null, children);

beforeEach(() => {
  jest.clearAllMocks();
  mockCycle = { id: 'cycle', isActive: true, config: 'old' };
  mockReadConfig.mockImplementation(async (cycle) => (cycle?.config === 'new' ? updated : initial));
});

it.each([true, false])(
  'refreshes config immediately when a mutable active=%s model emits',
  async (active) => {
    mockCycle.isActive = active;
    const { result } = renderHook(() => useMenstrualCycleContext(), { wrapper });
    await waitFor(() => expect(result.current.config).toEqual(initial));
    await act(async () => {});
    await act(async () => {
      mockCycle.config = 'new';
      mockObserver.next([mockCycle]);
    });
    await waitFor(() => expect(result.current.config).toEqual(updated));
    expect((active ? result.current.cycle : result.current.pausedCycle)?.id).toBe('cycle');
  }
);

it('ignores decryption from an older config emission after the next one completes', async () => {
  const { result, unmount } = renderHook(() => useMenstrualCycleContext(), { wrapper });
  await act(async () => {});
  let finish!: (value: CycleConfig) => void;
  mockReadConfig.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  await act(async () => {
    mockCycle.config = 'pending';
    mockObserver.next([mockCycle]);
  });
  await act(async () => {
    mockCycle.config = 'new';
    mockObserver.next([mockCycle]);
  });
  await waitFor(() => expect(result.current.config).toEqual(updated));
  await act(async () => finish({ ...initial, fallbackCycleLength: 40 }));
  expect(result.current.config).toEqual(updated);
  unmount();
  expect(mockUnsubscribe).toHaveBeenCalled();
});

it('observes shared mood once for every cycle surface, and only while a cycle exists', async () => {
  const { result, unmount } = renderHook(() => useMenstrualCycleContext(), { wrapper });
  await act(async () => {});
  expect(result.current.moods).toEqual([{ date: 1, value: 3 }]);
  expect(result.current.moodsLoading).toBe(false);
  expect(mockMoods).toHaveBeenLastCalledWith(true);
  // `today` is a local midnight that only moves with the calendar day, not a minute clock.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expect(result.current.today).toBe(today.getTime());
  unmount();
});
