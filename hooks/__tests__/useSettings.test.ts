/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { APP_LOCK_SCOPES_SETTING_TYPE, UNITS_SETTING_TYPE } from '@/constants/settings';
import { SettingsProvider } from '@/context/SettingsContext';
import { useSettings } from '@/hooks/useSettings';

type FakeSetting = { id: string; type: string; updatedAt: number; value: string };

let unsubscribeFn: jest.Mock;

const createMockObservable = (initialEmit: FakeSetting[]) => ({
  subscribe: (handlers: { error?: (e: unknown) => void; next: (v: FakeSetting[]) => void }) => {
    handlers.next(initialEmit);
    unsubscribeFn = jest.fn();
    return { unsubscribe: unsubscribeFn };
  },
});

const unitsSetting = (value: string): FakeSetting => ({
  id: '1',
  type: UNITS_SETTING_TYPE,
  updatedAt: 1,
  value,
});

const mockQuery = {
  observeWithColumns: jest.fn(),
};

const mockCollection = {
  query: jest.fn(() => mockQuery),
};

jest.mock('../../database/database-instance', () => ({
  database: {
    get: jest.fn(() => mockCollection),
  },
}));

const mockIsDbReady = jest.fn(() => true);

jest.mock('../../database/dbReady', () => ({
  isDbReady: () => mockIsDbReady(),
  waitForDbReady: jest.fn(() => Promise.resolve()),
}));

const mockGetSettingsMirror = jest.fn((): unknown => null);
const mockRecordSettingsMirror = jest.fn();

jest.mock('../../utils/settingsMirror', () => ({
  getSettingsMirror: () => mockGetSettingsMirror(),
  recordSettingsMirror: (next: unknown) => mockRecordSettingsMirror(next),
}));

// Subscribes and never emits: the provider stays in its loading state.
const neverEmits = () => ({
  subscribe: () => {
    unsubscribeFn = jest.fn();
    return { unsubscribe: unsubscribeFn };
  },
});

// jsdom trips the static-export guard (`Platform.OS === 'web'` + a jsdom user agent),
// which would make the provider skip the subscription entirely.
jest.mock('../../constants/platform', () => ({
  isStaticExport: false,
}));

// The provider decrypts the AI keys once settings load; not what these tests are about.
jest.mock('../../database/services/SettingsService', () => ({
  SettingsService: {
    getGoogleGeminiApiKey: jest.fn().mockResolvedValue(''),
    getLocalLlmApiKey: jest.fn().mockResolvedValue(''),
    getOpenAiApiKey: jest.fn().mockResolvedValue(''),
    getClaudeApiKey: jest.fn().mockResolvedValue(''),
  },
}));

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SettingsProvider, null, children);

describe('useSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDbReady.mockReturnValue(true);
    mockGetSettingsMirror.mockReturnValue(null);
    mockQuery.observeWithColumns.mockReturnValue(createMockObservable([]));
  });

  // With no stored units setting the provider falls back to `getDefaultUnits()`, which is
  // locale-derived — and the shared `expo-localization` mock reports a US locale.
  it('falls back to the locale default and isLoading false after first emit when no settings', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.units).toBe('imperial');
    expect(result.current.weightUnit).toBe('lbs');
    expect(result.current.heightUnit).toBe('in');
  });

  it('returns imperial when settings emit value 1', async () => {
    mockQuery.observeWithColumns.mockReturnValue(createMockObservable([unitsSetting('1')]));

    const { result } = renderHook(() => useSettings(), { wrapper });

    // Gate on `isLoading` rather than on `units`: the pre-emit default is imperial too,
    // so waiting on `units` alone would pass before the setting had been read at all.
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.units).toBe('imperial');
    expect(result.current.weightUnit).toBe('lbs');
    expect(result.current.heightUnit).toBe('in');
  });

  it('returns metric when settings emit value 0', async () => {
    mockQuery.observeWithColumns.mockReturnValue(createMockObservable([unitsSetting('0')]));

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.units).toBe('metric');
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(unsubscribeFn).toBeDefined();
    });

    unmount();
    expect(unsubscribeFn).toHaveBeenCalled();
  });

  it('handles error by falling back to the locale default and isLoading false', async () => {
    mockQuery.observeWithColumns.mockReturnValue({
      subscribe: (handlers: { error?: (e: unknown) => void; next: (v: FakeSetting[]) => void }) => {
        setTimeout(() => handlers.error!(new Error('db error')), 0);
        unsubscribeFn = jest.fn();
        return { unsubscribe: unsubscribeFn };
      },
    });

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.units).toBe('imperial');
  });

  describe('settings mirror', () => {
    it('starts from the mirrored theme, language and units before the table emits', async () => {
      mockGetSettingsMirror.mockReturnValue({
        theme: 'kinetic-volt',
        language: 'pt-BR',
        units: 'metric',
        appLockScopesRaw: '',
      });
      mockQuery.observeWithColumns.mockReturnValue(neverEmits());

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.theme).toBe('kinetic-volt');
      expect(result.current.language).toBe('pt-BR');
      // The locale default here is imperial, so metric can only have come from the mirror.
      expect(result.current.units).toBe('metric');
    });

    it('writes every value read from the table back to the mirror', async () => {
      mockQuery.observeWithColumns.mockReturnValue(
        createMockObservable([
          unitsSetting('0'),
          { id: '2', type: APP_LOCK_SCOPES_SETTING_TYPE, updatedAt: 1, value: 'cycle' },
        ])
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(mockRecordSettingsMirror).toHaveBeenCalledWith({
        theme: 'system',
        language: 'en-US',
        units: 'metric',
        appLockScopesRaw: 'cycle',
      });
    });
  });

  describe('appLockScopesPending', () => {
    it('is true while loading with no mirror, and clears once the table is read', async () => {
      let emit!: (settings: FakeSetting[]) => void;
      mockQuery.observeWithColumns.mockReturnValue({
        subscribe: (handlers: { next: (v: FakeSetting[]) => void }) => {
          emit = handlers.next;
          unsubscribeFn = jest.fn();
          return { unsubscribe: unsubscribeFn };
        },
      });

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.appLockScopesPending).toBe(true);
      await waitFor(() => {
        expect(emit).toBeDefined();
      });

      emit([{ id: '1', type: APP_LOCK_SCOPES_SETTING_TYPE, updatedAt: 1, value: 'app' }]);

      await waitFor(() => {
        expect(result.current.appLockScopesPending).toBe(false);
      });
      expect(result.current.appLockScopes).toEqual(['app']);
    });

    it('trusts the mirrored scopes while loading', () => {
      mockGetSettingsMirror.mockReturnValue({
        theme: 'system',
        language: 'en-US',
        units: 'metric',
        appLockScopesRaw: 'app',
      });
      mockQuery.observeWithColumns.mockReturnValue(neverEmits());

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.appLockScopesPending).toBe(false);
      expect(result.current.appLockScopes).toEqual(['app']);
    });

    // AppDbReadyGate mounts the providers before the database is ready only for an install that
    // has not finished onboarding, which cannot have a lock yet.
    it('is false for an install whose database was not ready at mount', () => {
      mockIsDbReady.mockReturnValue(false);
      mockQuery.observeWithColumns.mockReturnValue(neverEmits());

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.appLockScopesPending).toBe(false);
    });
  });
});
