import { act, renderHook, waitFor } from '@testing-library/react';
import { AppState } from 'react-native';

import { NutritionService } from '@/database/services/NutritionService';
import { widgetEvents } from '@/utils/widgetEvents';
import CycleWidget from '@/widgets/CycleWidget';
import NutritionWidget from '@/widgets/NutritionWidget';
import { WidgetSync } from '@/widgets/WidgetSync';

let mockLoading = false;
let mockLocale = 'en-us';
let mockDay = new Date(2026, 9, 17).getTime();
const mockTranslate = (key: string) => key;
const mockTheme = {
  colors: {
    background: { primary: '#001122' },
    text: { primary: '#ffffff', secondary: '#aaaaaa' },
    accent: { primary: '#445566' },
    macros: { protein: { bg: '#123456' }, carbs: { bg: '#234567' }, fat: { bg: '#345678' } },
  },
};

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('expo-asset', () => ({ Asset: {} }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-widgets', () => ({ widgetsDirectory: null }));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: mockTranslate,
    i18n: { resolvedLanguage: mockLocale, language: mockLocale },
  }),
}));
jest.mock('@/context/ThemeContext', () => ({ useThemeContext: () => ({ theme: mockTheme }) }));
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ isLoading: mockLoading }) }));
jest.mock('@/hooks/useLocalToday', () => ({ useLocalToday: () => mockDay }));
jest.mock('@/database/dbReady', () => ({ waitForDbReady: jest.fn(async () => {}) }));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    getDailyNutrients: jest.fn(async () => ({
      calories: 900,
      protein: 40,
      carbs: 110,
      fat: 20,
      fiber: 10,
    })),
  },
}));
jest.mock('@/database/services/NutritionGoalService', () => ({
  NutritionGoalService: {
    getGoalForDate: jest.fn(async () => ({
      totalCalories: 1800,
      protein: 80,
      carbs: 200,
      fats: 40,
    })),
  },
}));
jest.mock('@/database/services/NutritionTargetService', () => ({
  NutritionTargetService: {
    resolve: jest.fn(async () => ({ totalCalories: 2000, protein: 80, carbs: 200, fats: 40 })),
  },
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn(async () => {}) }));
jest.mock('@/widgets/NutritionWidget', () => ({
  __esModule: true,
  default: { updateTimeline: jest.fn(), updateSnapshot: jest.fn() },
}));
jest.mock('@/widgets/CycleWidget', () => ({
  __esModule: true,
  default: { updateTimeline: jest.fn(), updateSnapshot: jest.fn() },
}));
jest.mock('@/widgets/cycleWidgetData', () => ({
  loadCycleWidgetInputs: jest.fn(async () => ({ lockScopes: ['cycle'], elapsedDay: null })),
  subscribeToCycleChanges: jest.fn(() => jest.fn()),
}));
jest.mock('@/widgets/SmartCameraWidget', () => ({
  __esModule: true,
  default: { updateSnapshot: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockLoading = false;
  mockLocale = 'en-us';
});

it('waits for settings and publishes resolved targets with a midnight expiration', async () => {
  mockLoading = true;
  const { rerender, unmount } = renderHook(() => WidgetSync());
  expect(NutritionService.getDailyNutrients).not.toHaveBeenCalled();
  mockLoading = false;
  rerender();
  await waitFor(() => expect(NutritionWidget.updateTimeline).toHaveBeenCalledTimes(1));
  const entries = (NutritionWidget.updateTimeline as jest.Mock).mock.calls[0][0];
  expect(entries[0].props.calorieTarget).toContain('2000');
  expect(entries[1].date.getHours()).toBe(0);
  expect(entries[0].props.state).toBe('ready');
  expect(entries[1].props.state).toBe('stale');
  expect(entries[0].props.palette.background).toBe('#001122');
  unmount();
});

it('refreshes after nutrition events, foregrounding, language and day changes, and unsubscribes', async () => {
  const { rerender, unmount } = renderHook(() => WidgetSync());
  await waitFor(() => expect(NutritionWidget.updateTimeline).toHaveBeenCalledTimes(1));
  act(() => widgetEvents.emitNutritionWidgetUpdate());
  await waitFor(() => expect(NutritionWidget.updateTimeline).toHaveBeenCalledTimes(2));
  const foreground = (AppState.addEventListener as jest.Mock).mock.calls[0][1];
  act(() => foreground('active'));
  await waitFor(() => expect(NutritionWidget.updateTimeline).toHaveBeenCalledTimes(3));
  mockLocale = 'nl-nl';
  rerender();
  await waitFor(() => expect(NutritionWidget.updateTimeline).toHaveBeenCalledTimes(4));
  mockDay += 86400000;
  rerender();
  await waitFor(() => expect(NutritionWidget.updateTimeline).toHaveBeenCalledTimes(5));
  unmount();
  act(() => widgetEvents.emitNutritionWidgetUpdate());
  expect(NutritionService.getDailyNutrients).toHaveBeenCalledTimes(5);
  expect((AppState.addEventListener as jest.Mock).mock.results[0].value.remove).toHaveBeenCalled();
});

describe('cycle widget', () => {
  const { loadCycleWidgetInputs, subscribeToCycleChanges } = jest.requireMock(
    '@/widgets/cycleWidgetData'
  );

  it('publishes the neutral snapshot with a midnight expiration', async () => {
    const { unmount } = renderHook(() => WidgetSync());
    await waitFor(() => expect(CycleWidget.updateTimeline).toHaveBeenCalledTimes(1));
    const entries = (CycleWidget.updateTimeline as jest.Mock).mock.calls[0][0];
    expect(entries[0].props.value).toBe('');
    expect(entries[0].props.caption).toBe('widgets.cycle.privateCaption');
    expect(entries[1].date.getHours()).toBe(0);
    unmount();
  });

  it('refreshes after a cycle record change and stops listening on unmount', async () => {
    const unsubscribe = jest.fn();
    let notify: () => void = () => {};
    (subscribeToCycleChanges as jest.Mock).mockImplementationOnce((listener: () => void) => {
      notify = listener;
      return unsubscribe;
    });
    const { unmount } = renderHook(() => WidgetSync());
    await waitFor(() => expect(CycleWidget.updateTimeline).toHaveBeenCalledTimes(1));
    act(() => notify());
    await waitFor(() => expect(CycleWidget.updateTimeline).toHaveBeenCalledTimes(2));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('replaces the widget with the neutral snapshot when the records cannot be read', async () => {
    (loadCycleWidgetInputs as jest.Mock).mockRejectedValueOnce(new Error('locked'));
    const { unmount } = renderHook(() => WidgetSync());
    await waitFor(() => expect(CycleWidget.updateTimeline).toHaveBeenCalledTimes(1));
    const [{ props }] = (CycleWidget.updateTimeline as jest.Mock).mock.calls[0][0];
    expect(props.value).toBe('');
    expect(props.state).toBe('private');
    unmount();
  });
});
