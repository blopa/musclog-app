import { render, waitFor } from '@testing-library/react';
import { createElement } from 'react';

import { NutritionService } from '@/database/services/NutritionService';
import { WidgetSync } from '@/widgets/WidgetSync';

const mockCycleSnapshot = jest.fn();
const mockCycleTimeline = jest.fn();
const mockNutritionSnapshot = jest.fn();
const mockNutritionTimeline = jest.fn();
const mockCameraSnapshot = jest.fn();
const mockReadCycleInputs = jest.fn();
const mockReport = jest.fn();
const mockTranslate = (key: string) => key;
const mockTheme = { colors: {} };
let mockSettings = {
  isLoading: false,
  appLockScopes: [] as string[],
  cycleNotificationStyle: 'detailed',
};

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Platform: { OS: 'android' },
  AppState: { addEventListener: () => ({ remove: jest.fn() }) },
}));
jest.mock('expo-asset', () => ({ Asset: {} }));
jest.mock('expo-file-system', () => ({ File: {} }));
jest.mock('expo-widgets', () => ({ widgetsDirectory: null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate, i18n: { language: 'en-US' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/context/ThemeContext', () => ({ useThemeContext: () => ({ theme: mockTheme }) }));
jest.mock('@/hooks/useLocalToday', () => ({ useLocalToday: () => 0 }));
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => mockSettings }));
jest.mock('@/database/dbReady', () => ({ waitForDbReady: async () => {} }));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: { getDailyNutrients: jest.fn() },
}));
jest.mock('@/database/services/NutritionGoalService', () => ({
  NutritionGoalService: { getGoalForDate: async () => null },
}));
jest.mock('@/database/services/NutritionTargetService', () => ({ NutritionTargetService: {} }));
jest.mock('@/utils/handleError', () => ({
  handleError: (...args: unknown[]) => mockReport(...args),
}));
jest.mock('@/widgets/cycleWidgetData', () => ({
  loadCycleWidgetInputs: () => mockReadCycleInputs(),
  subscribeToCycleChanges: () => jest.fn(),
}));
jest.mock('@/widgets/CycleWidget', () => ({
  __esModule: true,
  default: {
    updateSnapshot: (...args: unknown[]) => mockCycleSnapshot(...args),
    updateTimeline: (...args: unknown[]) => mockCycleTimeline(...args),
  },
}));
jest.mock('@/widgets/NutritionWidget', () => ({
  __esModule: true,
  default: {
    updateSnapshot: (...args: unknown[]) => mockNutritionSnapshot(...args),
    updateTimeline: (...args: unknown[]) => mockNutritionTimeline(...args),
  },
}));
jest.mock('@/widgets/SmartCameraWidget', () => ({
  __esModule: true,
  default: { updateSnapshot: (...args: unknown[]) => mockCameraSnapshot(...args) },
}));
jest.mock('@/widgets/widgetSnapshot', () => ({
  widgetPalette: () => ({}),
  buildNutritionWidgetSnapshot: () => ({ value: 'nutrition' }),
  expiredWidgetSnapshot: () => ({ value: '' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings = { isLoading: false, appLockScopes: [], cycleNotificationStyle: 'detailed' };
  mockReadCycleInputs.mockResolvedValue({
    lockScopes: [],
    style: 'detailed',
    cycle: { timeline: { elapsedDay: 12, prediction: { state: 'hidden' } }, activePeriod: null },
  });
  jest.mocked(NutritionService.getDailyNutrients).mockResolvedValue({} as never);
});

it.each(['android', 'ios'])(
  'hides cycle details despite nutrition failure on %s',
  async (platform) => {
    const { Platform } = jest.requireMock('react-native');
    Platform.OS = platform;
    const latestCycle = () =>
      platform === 'ios'
        ? mockCycleTimeline.mock.calls.at(-1)?.[0][0].props
        : mockCycleSnapshot.mock.calls.at(-1)?.[0];
    const view = render(createElement(WidgetSync));
    await waitFor(() => expect(latestCycle()?.value).toBe('12'));

    jest
      .mocked(NutritionService.getDailyNutrients)
      .mockRejectedValue(new Error('nutrition failed'));
    mockReadCycleInputs.mockResolvedValue({
      lockScopes: ['cycle'],
      style: 'detailed',
      cycle: null,
    });
    mockSettings = { ...mockSettings, appLockScopes: ['cycle'] };
    view.rerender(createElement(WidgetSync));
    await waitFor(() => expect(latestCycle()?.value).toBe(''));
    expect(latestCycle().detail).toBe('');
  }
);

it('publishes the private fallback while nutrition never finishes', async () => {
  jest.mocked(NutritionService.getDailyNutrients).mockImplementation(() => new Promise(() => {}));
  mockReadCycleInputs.mockRejectedValue(new Error('cycle read failed'));
  const { Platform } = jest.requireMock('react-native');
  Platform.OS = 'android';
  render(createElement(WidgetSync));
  await waitFor(() =>
    expect(mockCycleSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ value: '', detail: '', caption: 'widgets.cycle.privateCaption' })
    )
  );
  expect(mockNutritionSnapshot).not.toHaveBeenCalled();
  expect(mockCameraSnapshot).toHaveBeenCalled();
});
