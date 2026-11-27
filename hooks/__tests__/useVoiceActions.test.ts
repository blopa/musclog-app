/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useVoiceActions, useVoiceTask } from '@/hooks/useVoiceActions';
import type { VoiceAction } from '@/utils/voiceCommand/types';
import {
  setPendingVoiceAction,
  takePendingVoiceAction,
} from '@/utils/voiceCommand/voiceActionInbox';

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

const NOTE_KINDS = ['addNote'] as const;
const SEARCH_KINDS = ['searchFood'] as const;

const SEARCH: VoiceAction = {
  kind: 'searchFood',
  day: new Date(2026, 10, 26),
  mealType: 'dinner',
  query: 'oats',
};
const NOTE: VoiceAction = { kind: 'addNote', body: 'bought oats' };

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused.current = true;
  setPendingVoiceAction(null);
});

describe('useVoiceActions', () => {
  it('performs only the kinds it lists and leaves the others pending', () => {
    setPendingVoiceAction(SEARCH);
    const perform = jest.fn();
    renderHook(() => useVoiceActions(NOTE_KINDS, perform));

    expect(perform).not.toHaveBeenCalled();
    expect(takePendingVoiceAction(SEARCH_KINDS)).toBe(SEARCH);
  });

  it('performs a pending action of its kind once, on mount', () => {
    setPendingVoiceAction(NOTE);
    const perform = jest.fn();
    renderHook(() => useVoiceActions(NOTE_KINDS, perform));

    expect(perform).toHaveBeenCalledTimes(1);
    expect(perform).toHaveBeenCalledWith(NOTE);
    expect(takePendingVoiceAction(NOTE_KINDS)).toBeNull();
  });

  it('performs an action of its kind set while focused', () => {
    const perform = jest.fn();
    renderHook(() => useVoiceActions(NOTE_KINDS, perform));
    expect(perform).not.toHaveBeenCalled();

    act(() => setPendingVoiceAction(NOTE));

    expect(perform).toHaveBeenCalledWith(NOTE);
  });

  it('ignores an action of another kind set while focused', () => {
    const perform = jest.fn();
    renderHook(() => useVoiceActions(NOTE_KINDS, perform));

    act(() => setPendingVoiceAction(SEARCH));

    expect(perform).not.toHaveBeenCalled();
    expect(takePendingVoiceAction(SEARCH_KINDS)).toBe(SEARCH);
  });

  it('does not perform an action when the screen is not focused', () => {
    mockFocused.current = false;
    setPendingVoiceAction(NOTE);
    const perform = jest.fn();
    renderHook(() => useVoiceActions(NOTE_KINDS, perform));

    expect(perform).not.toHaveBeenCalled();
    expect(takePendingVoiceAction(NOTE_KINDS)).toEqual(NOTE);
  });
});

describe('useVoiceTask', () => {
  function renderTask() {
    const hook = renderHook(({ isOpen }: { isOpen: boolean }) => useVoiceTask(isOpen), {
      initialProps: { isOpen: false },
    });

    return hook;
  }

  it('shows the wrong-task snackbar once after a begun task closes', () => {
    const { result, rerender } = renderTask();

    act(() => result.current.begin());
    rerender({ isOpen: true });
    expect(mockShowSnackbar).not.toHaveBeenCalled();

    rerender({ isOpen: false });

    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar.mock.calls[0][1]).toBe('voiceInput.command.wrongTask');

    rerender({ isOpen: true });
    rerender({ isOpen: false });
    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
  });

  it('does not show the notice when the sheet closes before it was seen open', () => {
    const { result, rerender } = renderTask();

    act(() => result.current.begin());
    rerender({ isOpen: false });

    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('does not show the notice for a sheet the person opened themselves (forget)', () => {
    const { result, rerender } = renderTask();

    act(() => result.current.begin());
    act(() => result.current.forget());
    rerender({ isOpen: true });
    rerender({ isOpen: false });

    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('offers the AI settings from the snackbar action', () => {
    const { result, rerender } = renderTask();

    act(() => result.current.begin());
    rerender({ isOpen: true });
    rerender({ isOpen: false });

    const options = mockShowSnackbar.mock.calls[0][2];
    options.onAction();

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/app/settings',
      params: { openAi: expect.any(String) },
    });
  });
});
