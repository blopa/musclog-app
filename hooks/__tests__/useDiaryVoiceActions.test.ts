/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useDiaryVoiceActions } from '@/hooks/useDiaryVoiceActions';
import {
  setPendingVoiceAction,
  takePendingVoiceAction,
} from '@/utils/voiceCommand/voiceActionInbox';
import type { VoiceAction } from '@/utils/voiceCommand/types';

// The mocked focus effect runs its callback only while `mockFocused.current` is true, like the real
// one runs only for the focused screen.
const mockFocused = { current: true };
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: (...args: unknown[]) => mockNavigate(...args) }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    require('react').useEffect(() => (mockFocused.current ? callback() : undefined), [callback]);
  },
}));

const mockNavigate = jest.fn();
const mockShowSnackbar = jest.fn();
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

const targetDay = new Date(2026, 10, 26);
const sourceDay = new Date(2026, 10, 25);

function copyMealAction(): VoiceAction {
  return {
    kind: 'copyMeal',
    targetDay,
    sourceDay,
    meals: { source: 'breakfast', target: 'lunch' },
  } as VoiceAction;
}

function searchFoodAction(): VoiceAction {
  return {
    kind: 'searchFood',
    day: targetDay,
    mealType: 'dinner',
    query: 'oats',
  } as VoiceAction;
}

function makeHandlers() {
  return {
    setSelectedDate: jest.fn(),
    selectMealType: jest.fn(),
    openCopyDay: jest.fn(),
    openFoodSearch: jest.fn(),
    isTaskOpen: false,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused.current = true;
  setPendingVoiceAction(null);
});

describe('useDiaryVoiceActions', () => {
  it('performs a copyMeal action pending before mount and clears the inbox', () => {
    setPendingVoiceAction(copyMealAction());
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDiaryVoiceActions(handlers));

    expect(handlers.setSelectedDate).toHaveBeenCalledWith(targetDay);
    expect(handlers.openCopyDay).toHaveBeenCalledTimes(1);
    expect(result.current.copyScope).toEqual({
      sourceDay,
      meals: { source: 'breakfast', target: 'lunch' },
    });
    expect(takePendingVoiceAction()).toBeNull();
  });

  it('performs a searchFood action pending before mount without opening the copy review', () => {
    setPendingVoiceAction(searchFoodAction());
    const handlers = makeHandlers();
    renderHook(() => useDiaryVoiceActions(handlers));

    expect(handlers.setSelectedDate).toHaveBeenCalledWith(targetDay);
    expect(handlers.selectMealType).toHaveBeenCalledWith('dinner');
    expect(handlers.openFoodSearch).toHaveBeenCalledWith('all', 'oats');
    expect(handlers.openCopyDay).not.toHaveBeenCalled();
    expect(takePendingVoiceAction()).toBeNull();
  });

  it('performs an action set while focused', () => {
    const handlers = makeHandlers();
    renderHook(() => useDiaryVoiceActions(handlers));
    expect(handlers.openFoodSearch).not.toHaveBeenCalled();

    act(() => setPendingVoiceAction(searchFoodAction()));

    expect(handlers.openFoodSearch).toHaveBeenCalledWith('all', 'oats');
    expect(takePendingVoiceAction()).toBeNull();
  });

  it('leaves the action pending when the screen is not focused', () => {
    mockFocused.current = false;
    setPendingVoiceAction(copyMealAction());
    const handlers = makeHandlers();
    renderHook(() => useDiaryVoiceActions(handlers));

    expect(handlers.openCopyDay).not.toHaveBeenCalled();
    expect(handlers.setSelectedDate).not.toHaveBeenCalled();
    expect(takePendingVoiceAction()).toEqual(copyMealAction());
  });

  it('clears copyScope and opens the copy day for the whole-day entry', () => {
    setPendingVoiceAction(copyMealAction());
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDiaryVoiceActions(handlers));
    expect(result.current.copyScope).not.toBeNull();

    act(() => result.current.openWholeCopyDay());

    expect(result.current.copyScope).toBeNull();
    expect(handlers.openCopyDay).toHaveBeenCalledTimes(2);
  });

  it('does not perform a new action after unmount', () => {
    const handlers = makeHandlers();
    const { unmount } = renderHook(() => useDiaryVoiceActions(handlers));
    unmount();

    setPendingVoiceAction(searchFoodAction());

    expect(handlers.openFoodSearch).not.toHaveBeenCalled();
    expect(takePendingVoiceAction()).toEqual(searchFoodAction());
  });
});

describe('useDiaryVoiceActions wrong-task prompt', () => {
  function renderTask() {
    const handlers = makeHandlers();
    const hook = renderHook(
      (isTaskOpen: boolean) => useDiaryVoiceActions({ ...handlers, isTaskOpen }),
      { initialProps: false }
    );

    return { handlers, ...hook };
  }

  it('offers the AI settings once a voice task closes, and goes there when tapped', () => {
    const { rerender } = renderTask();
    act(() => setPendingVoiceAction(searchFoodAction()));
    rerender(true);
    expect(mockShowSnackbar).not.toHaveBeenCalled();

    rerender(false);

    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    const [type, message, options] = mockShowSnackbar.mock.calls[0];
    expect([type, message, options.action]).toEqual([
      'success',
      'voiceInput.command.wrongTask',
      'voiceInput.command.openAiSettings',
    ]);
    expect(options.onPress).toBe(options.onAction);

    options.onAction();

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/app/settings',
      params: { openAi: expect.any(String) },
    });

    rerender(true);
    rerender(false);
    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
  });

  it('says nothing when a sheet the person opened closes', () => {
    const { result, rerender } = renderTask();
    act(() => result.current.openWholeCopyDay());
    rerender(true);
    rerender(false);

    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });
});
