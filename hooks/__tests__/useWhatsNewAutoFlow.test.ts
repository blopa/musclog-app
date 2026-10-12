import { act, renderHook, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { WHATS_NEW_SEEN_THROUGH_KEY } from '@/constants/whatsNew';
import { waitForDbReady } from '@/database/dbReady';
import { getAppVersion } from '@/utils/appVersion';
import { isOnboardingCompleted } from '@/utils/onboardingService';
import { getWhatsNewSeenThrough } from '@/utils/whatsNew/storage';

import { resetWhatsNewAutoFlowSession, useWhatsNewAutoFlow } from '../useWhatsNewAutoFlow';

let mockFocused = true;
let mockStaticExport = false;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@/constants/platform', () => ({ get isStaticExport() { return mockStaticExport; } }));
jest.mock('@/database/dbReady', () => ({ waitForDbReady: jest.fn(async () => undefined) }));
jest.mock('@/utils/onboardingService', () => ({ isOnboardingCompleted: jest.fn(async () => true) }));
jest.mock('@/utils/appVersion', () => ({ getAppVersion: jest.fn(() => '2.13.0') }));
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockFocused = true;
  mockStaticExport = false;
  jest.mocked(getAppVersion).mockReturnValue('2.13.0');
  jest.mocked(isOnboardingCompleted).mockResolvedValue(true);
  resetWhatsNewAutoFlowSession();
});
test('waits for DB and onboarding, then displays on home only', async () => {
  let ready!: () => void;
  jest.mocked(waitForDbReady).mockReturnValueOnce(new Promise((resolve) => { ready = resolve; }));
  const { result, rerender } = renderHook(() => useWhatsNewAutoFlow());
  expect(result.current.visible).toBe(false);
  expect(isOnboardingCompleted).not.toHaveBeenCalled();
  await act(async () => ready());
  await waitFor(() => expect(result.current.visible).toBe(true));
  mockFocused = false;
  rerender();
  expect(result.current.visible).toBe(false);
  mockFocused = true;
  rerender();
  await waitFor(() => expect(result.current.visible).toBe(true));
  expect(waitForDbReady).toHaveBeenCalledTimes(1);
});
test('dismisses once per session, saves before resolving, and debug reset re-arms home', async () => {
  const { result, rerender } = renderHook(() => useWhatsNewAutoFlow());
  await waitFor(() => expect(result.current.visible).toBe(true));
  await act(async () => result.current.dismiss());
  expect(await getWhatsNewSeenThrough()).toBe('2.13.0');
  expect(result.current.visible).toBe(false);
  mockFocused = false; rerender(); mockFocused = true; rerender();
  expect(waitForDbReady).toHaveBeenCalledTimes(1);
  await AsyncStorage.removeItem(WHATS_NEW_SEEN_THROUGH_KEY);
  resetWhatsNewAutoFlowSession();
  mockFocused = false; rerender(); mockFocused = true; rerender();
  await waitFor(() => expect(result.current.visible).toBe(true));
});
test('new installs and newer restored backups do not show; downgrades keep the maximum', async () => {
  await AsyncStorage.setItem(WHATS_NEW_SEEN_THROUGH_KEY, '3.0.0');
  const { result } = renderHook(() => useWhatsNewAutoFlow());
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(WHATS_NEW_SEEN_THROUGH_KEY, '3.0.0'));
  expect(result.current.visible).toBe(false);
  expect(await getWhatsNewSeenThrough()).toBe('3.0.0');
});
test('an empty release range advances silently', async () => {
  jest.mocked(getAppVersion).mockReturnValue('2.12.5');
  const { result } = renderHook(() => useWhatsNewAutoFlow());
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(WHATS_NEW_SEEN_THROUGH_KEY, '2.12.5'));
  expect(result.current.visible).toBe(false);
});
test('does not consume an unfinished flow when unmounted; a remount shares the session check', async () => {
  const first = renderHook(() => useWhatsNewAutoFlow());
  await waitFor(() => expect(first.result.current.visible).toBe(true));
  first.unmount();
  const next = renderHook(() => useWhatsNewAutoFlow());
  await waitFor(() => expect(next.result.current.visible).toBe(true));
  expect(waitForDbReady).toHaveBeenCalledTimes(1);
  expect(await getWhatsNewSeenThrough()).toBeNull();
});
test.each(['unfocused', 'static', 'widget'])('does not check on %s', async (gate) => {
  mockFocused = gate !== 'unfocused'; mockStaticExport = gate === 'static';
  const { result } = renderHook(() => useWhatsNewAutoFlow({ suppressed: gate === 'widget' }));
  await act(async () => undefined);
  expect(waitForDbReady).not.toHaveBeenCalled();
  expect(result.current.visible).toBe(false);
  expect(await getWhatsNewSeenThrough()).toBeNull();
});
test('incomplete onboarding is not marked seen and can finish in the same session', async () => {
  jest.mocked(isOnboardingCompleted).mockResolvedValueOnce(false);
  const { result, rerender } = renderHook(() => useWhatsNewAutoFlow());
  await act(async () => undefined);
  expect(result.current.visible).toBe(false);
  expect(await getWhatsNewSeenThrough()).toBeNull();
  mockFocused = false; rerender(); mockFocused = true; rerender();
  await waitFor(() => expect(result.current.visible).toBe(true));
});
test('failed dismissal keeps the flow open and can be retried', async () => {
  const { result } = renderHook(() => useWhatsNewAutoFlow());
  await waitFor(() => expect(result.current.visible).toBe(true));
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk'));
  await act(async () => { await expect(result.current.dismiss()).rejects.toThrow('disk'); });
  expect(result.current.visible).toBe(true);
  await act(async () => result.current.dismiss());
  expect(result.current.visible).toBe(false);
});
