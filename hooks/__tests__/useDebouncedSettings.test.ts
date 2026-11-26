/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { DEBOUNCED_SETTING_KEYS, useDebouncedSettings } from '@/hooks/useDebouncedSettings';
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
  showWeightPrediction: false,
  useOcrBeforeAi: false,
  aiImageQuality: 'medium',
  aiMealCameraFlow: 'detailed',
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

    setSettings({ showWeightPrediction: true });
    act(() => rerender());

    expect(result.current.showDailyMoodPrompt).toBe(true);
    expect(result.current.showWeightPrediction).toBe(true);
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

    act(() => result.current.handleShowDailyMoodPromptChange(true));

    await act(async () => {
      await result.current.flushAllPendingChanges();
    });

    expect(SettingsService.setShowDailyMoodPrompt).toHaveBeenCalledTimes(1);
    expect(SettingsService.setShowDailyMoodPrompt).toHaveBeenCalledWith(true);
    expect(result.current.hasPendingChanges).toBe(false);

    await runDebounce();
    expect(SettingsService.setShowDailyMoodPrompt).toHaveBeenCalledTimes(1);
  });

  it('cancels pending timers on cleanup so no write escapes after teardown', async () => {
    const { result } = renderHook(() => useDebouncedSettings());

    act(() => result.current.handleShowDailyMoodPromptChange(true));
    act(() => result.current.cleanup());

    await runDebounce();

    expect(SettingsService.setShowDailyMoodPrompt).not.toHaveBeenCalled();
  });

  it('reports a save failure without throwing and clears the pending flag', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (SettingsService.setShowDailyMoodPrompt as jest.Mock).mockRejectedValueOnce(
      new Error('write failed')
    );

    const { result } = renderHook(() => useDebouncedSettings());

    act(() => result.current.handleShowDailyMoodPromptChange(true));
    await runDebounce();

    expect(consoleError).toHaveBeenCalled();
    expect(result.current.hasPendingChanges).toBe(false);
    // The optimistic value stays on screen until the next DB emission corrects it.
    expect(result.current.showDailyMoodPrompt).toBe(true);
    consoleError.mockRestore();
  });

  it('debounces and flushes aiImageQuality and aiMealCameraFlow through SettingsService.set', async () => {
    const { result } = renderHook(() => useDebouncedSettings());

    act(() => {
      result.current.handleAiImageQualityChange('high');
      result.current.handleAiMealCameraFlowChange('quick');
    });

    expect(result.current.aiImageQuality).toBe('high');
    expect(result.current.aiMealCameraFlow).toBe('quick');
    expect(SettingsService.set).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.flushAllPendingChanges();
    });

    expect(SettingsService.set).toHaveBeenCalledWith(SETTINGS.aiImageQuality, 'high');
    expect(SettingsService.set).toHaveBeenCalledWith(SETTINGS.aiMealCameraFlow, 'quick');
    expect(result.current.hasPendingChanges).toBe(false);
  });

  it('exposes the value and a handle<Key>Change function for every key of the table', () => {
    const { result } = renderHook(() => useDebouncedSettings());
    const surface = result.current as unknown as Record<string, unknown>;

    expect(DEBOUNCED_SETTING_KEYS.length).toBeGreaterThan(40);

    for (const key of DEBOUNCED_SETTING_KEYS) {
      const handler = `handle${key.charAt(0).toUpperCase()}${key.slice(1)}Change`;

      expect(key in surface).toBe(true);
      expect(typeof surface[handler]).toBe('function');
    }
  });

  it('keeps handler identity stable across re-renders', () => {
    const { rerender, result } = renderHook(() => useDebouncedSettings());
    const before = result.current.handleUnitsChange;
    const beforeMood = result.current.handleShowDailyMoodPromptChange;

    setSettings({ units: 'imperial' });
    act(() => rerender());

    expect(result.current.handleUnitsChange).toBe(before);
    expect(result.current.handleShowDailyMoodPromptChange).toBe(beforeMood);
  });
});
