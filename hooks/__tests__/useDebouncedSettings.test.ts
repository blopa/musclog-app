/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { SettingsService } from '@/database/services/SettingsService';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { useSettings } from '@/hooks/useSettings';

jest.mock('@/hooks/useSettings', () => ({
  useSettings: jest.fn(),
}));

// The hook wires ~45 setters by reference at render time; a lazily-memoized jest.fn per
// property keeps the mock from having to restate that list.
jest.mock('@/database/services/SettingsService', () => {
  const setters = new Map<string, jest.Mock>();
  return {
    SettingsService: new Proxy({} as Record<string, jest.Mock>, {
      get: (_target, property: string) => {
        if (!setters.has(property)) {
          setters.set(property, jest.fn().mockResolvedValue(undefined));
        }
        return setters.get(property);
      },
    }),
  };
});

const mockUseSettings = useSettings as jest.Mock;

const baseSettings = {
  isLoading: false,
  showDailyMoodPrompt: false,
  theme: 'kinetic-light',
  useOcrBeforeAi: false,
  useOnDeviceAi: false,
};

const setSettings = (overrides: Record<string, unknown> = {}) => {
  // A fresh object each time: the DB → local sync effect keys off `actualSettings` identity.
  mockUseSettings.mockReturnValue({ ...baseSettings, ...overrides });
};

/** Fires the 200ms debounce timer and lets the resulting write settle. */
const runDebounce = async (ms = 200) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useDebouncedSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    setSettings();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the toggled value instantly and writes it only after the debounce window', async () => {
    const { result } = renderHook(() => useDebouncedSettings());

    expect(result.current.showDailyMoodPrompt).toBe(false);

    act(() => result.current.handleShowDailyMoodPromptChange(true));

    // Optimistic: the switch flips before anything touches the database.
    expect(result.current.showDailyMoodPrompt).toBe(true);
    expect(SettingsService.setShowDailyMoodPrompt).not.toHaveBeenCalled();

    await runDebounce(199);
    expect(SettingsService.setShowDailyMoodPrompt).not.toHaveBeenCalled();

    await runDebounce(1);
    expect(SettingsService.setShowDailyMoodPrompt).toHaveBeenCalledTimes(1);
    expect(SettingsService.setShowDailyMoodPrompt).toHaveBeenCalledWith(true);
  });

  it('collapses repeated toggles of one key into a single write of the final value', async () => {
    const { result } = renderHook(() => useDebouncedSettings());

    act(() => result.current.handleShowDailyMoodPromptChange(true));
    await runDebounce(150);
    act(() => result.current.handleShowDailyMoodPromptChange(false));
    await runDebounce(150);
    act(() => result.current.handleShowDailyMoodPromptChange(true));

    await runDebounce();

    expect(SettingsService.setShowDailyMoodPrompt).toHaveBeenCalledTimes(1);
    expect(SettingsService.setShowDailyMoodPrompt).toHaveBeenCalledWith(true);
  });

  // A settings emission caused by *another* key saving must not roll back a toggle the user
  // just made but that hasn't been written yet.
  it('keeps a pending optimistic value when a DB update arrives for a different key', () => {
    const { rerender, result } = renderHook(() => useDebouncedSettings());

    act(() => result.current.handleShowDailyMoodPromptChange(true));
    expect(result.current.hasPendingChanges).toBe(true);

    setSettings({ theme: 'kinetic-depth' });
    act(() => rerender());

    expect(result.current.showDailyMoodPrompt).toBe(true);
    expect(result.current.theme).toBe('kinetic-depth');
  });

  it('lets the database win again once the pending write has settled', async () => {
    const { rerender, result } = renderHook(() => useDebouncedSettings());

    act(() => result.current.handleShowDailyMoodPromptChange(true));
    await runDebounce();
    expect(result.current.hasPendingChanges).toBe(false);

    // The DB still reports false (e.g. the write failed, or another device won).
    setSettings({ showDailyMoodPrompt: false });
    act(() => rerender());

    expect(result.current.showDailyMoodPrompt).toBe(false);
  });

  it('writes a pending change immediately on flush and does not write it twice', async () => {
    const { result } = renderHook(() => useDebouncedSettings());

    act(() => result.current.handleThemeChange('kinetic-shock'));

    await act(async () => {
      await result.current.flushAllPendingChanges();
    });

    expect(SettingsService.setTheme).toHaveBeenCalledTimes(1);
    expect(SettingsService.setTheme).toHaveBeenCalledWith('kinetic-shock');
    expect(result.current.hasPendingChanges).toBe(false);

    await runDebounce();
    expect(SettingsService.setTheme).toHaveBeenCalledTimes(1);
  });

  // On-device AI can only work with locally-extracted text, so enabling it force-enables OCR.
  it('force-enables OCR-before-AI when on-device AI is switched on', async () => {
    const { result } = renderHook(() => useDebouncedSettings());

    act(() => result.current.handleUseOnDeviceAiChange(true));

    expect(result.current.useOnDeviceAi).toBe(true);
    expect(result.current.useOcrBeforeAi).toBe(true);

    await runDebounce();

    expect(SettingsService.setUseOnDeviceAi).toHaveBeenCalledWith(true);
    expect(SettingsService.setUseOcrBeforeAi).toHaveBeenCalledWith(true);
  });

  it('leaves OCR-before-AI alone when on-device AI is switched off', async () => {
    setSettings({ useOcrBeforeAi: true, useOnDeviceAi: true });
    const { result } = renderHook(() => useDebouncedSettings());

    act(() => result.current.handleUseOnDeviceAiChange(false));
    await runDebounce();

    expect(SettingsService.setUseOnDeviceAi).toHaveBeenCalledWith(false);
    expect(SettingsService.setUseOcrBeforeAi).not.toHaveBeenCalled();
    expect(result.current.useOcrBeforeAi).toBe(true);
  });

  it('cancels pending timers on cleanup so no write escapes after teardown', async () => {
    const { result } = renderHook(() => useDebouncedSettings());

    act(() => result.current.handleThemeChange('kinetic-depth'));
    act(() => result.current.cleanup());

    await runDebounce();

    expect(SettingsService.setTheme).not.toHaveBeenCalled();
  });

  it('reports a save failure without throwing and clears the pending flag', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (SettingsService.setTheme as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

    const { result } = renderHook(() => useDebouncedSettings());

    act(() => result.current.handleThemeChange('kinetic-depth'));
    await runDebounce();

    expect(consoleError).toHaveBeenCalled();
    expect(result.current.hasPendingChanges).toBe(false);
    // The optimistic value stays on screen until the next DB emission corrects it.
    expect(result.current.theme).toBe('kinetic-depth');
    consoleError.mockRestore();
  });
});
