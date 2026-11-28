/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useWorkoutsVoiceActions } from '@/hooks/useWorkoutsVoiceActions';
import {
  setPendingVoiceAction,
  takePendingVoiceAction,
} from '@/utils/voiceCommand/voiceActionInbox';

const mockFocused = { current: true };
const mockShowSnackbar = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    require('react').useEffect(() => (mockFocused.current ? callback() : undefined), [callback]);
  },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused.current = true;
  setPendingVoiceAction(null);
});

it('opens the pending preview and shows the wrong-task notice after it closes', () => {
  const openPreview = jest.fn();
  setPendingVoiceAction({ kind: 'previewWorkout', templateId: 't', planId: 'p' });
  const { rerender } = renderHook(
    (isPreviewOpen) => useWorkoutsVoiceActions({ openPreview, isPreviewOpen }),
    { initialProps: false }
  );
  expect(openPreview).toHaveBeenCalledWith('t', 'p');
  rerender(true);
  expect(mockShowSnackbar).not.toHaveBeenCalled();
  rerender(false);
  expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
});

it('leaves an action pending when unfocused and uses the latest callback when focused', () => {
  mockFocused.current = false;
  setPendingVoiceAction({ kind: 'previewWorkout', templateId: 't' });
  const openPreview = jest.fn();
  const { unmount } = renderHook(() =>
    useWorkoutsVoiceActions({ openPreview, isPreviewOpen: false })
  );
  expect(openPreview).not.toHaveBeenCalled();
  expect(takePendingVoiceAction(['previewWorkout'])).toEqual({
    kind: 'previewWorkout',
    templateId: 't',
  });
  unmount();
  mockFocused.current = true;
  const next = jest.fn();
  const hook = renderHook(
    ({ callback }) => useWorkoutsVoiceActions({ openPreview: callback, isPreviewOpen: false }),
    { initialProps: { callback: openPreview } }
  );
  hook.rerender({ callback: next });
  act(() => setPendingVoiceAction({ kind: 'previewWorkout', templateId: 'next' }));
  expect(next).toHaveBeenCalledWith('next', undefined);
});
