/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { ThemeProvider, ThemeScope } from '@/context/ThemeContext';
import { useSettings } from '@/hooks/useSettings';
import { useTheme, useThemeId, useThemeMode, useThemePreference } from '@/hooks/useTheme';
import { themeCssVariables } from '@/theme.tokens';
import { setMirroredThemePreference } from '@/utils/themeMirror';

let mockSystemColorScheme: 'dark' | 'light' = 'dark';

jest.mock('nativewind', () => ({
  __esModule: true,
  colorScheme: { set: jest.fn() },
  vars: (values: Record<string, unknown>) => values,
}));

const mockColorSchemeSet = jest.requireMock('nativewind').colorScheme.set as jest.Mock;

jest.mock('react-native', () => {
  const reactNativeWeb = jest.requireActual('react-native-web');
  return {
    ...reactNativeWeb,
    useColorScheme: () => mockSystemColorScheme,
  };
});

jest.mock('@/hooks/useSettings', () => ({
  useSettings: jest.fn(),
}));

const mockUseSettings = useSettings as jest.Mock;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(ThemeProvider, null, children);

const readTheme = () => ({
  id: useThemeId(),
  mode: useThemeMode(),
  theme: useTheme(),
});

describe('theme context', () => {
  beforeEach(() => {
    mockColorSchemeSet.mockClear();
    mockSystemColorScheme = 'dark';
    mockUseSettings.mockReturnValue({ theme: 'system' });
  });

  it('resolves the preference once and keeps every theme hook on the same value', () => {
    mockUseSettings.mockReturnValue({ theme: 'kinetic-shock' });

    const { result } = renderHook(readTheme, { wrapper });

    expect(result.current.id).toBe('kinetic-shock');
    expect(result.current.mode).toBe('dark');
    expect(result.current.theme.colors.accent.primary).toBe('#e85d9e');

    // The provider is the only consumer of the settings row: reading three theme
    // hooks must cost no more reads than reading one. The mirror is already warm
    // from the render above, so neither pass carries its extra commit render.
    mockUseSettings.mockClear();
    renderHook(readTheme, { wrapper });
    const withThreeHooks = mockUseSettings.mock.calls.length;

    mockUseSettings.mockClear();
    renderHook(() => useThemeId(), { wrapper });

    expect(mockUseSettings).toHaveBeenCalledTimes(withThreeHooks);
  });

  it('falls back to the mirrored preference while the settings row is unreadable', () => {
    // The marketing site never onboards, so `markDbReady()` is never called and
    // `isLoading` stays true forever. See `utils/themeMirror`.
    mockUseSettings.mockReturnValue({ isLoading: true, theme: 'system' });
    setMirroredThemePreference('kinetic-volt');

    const { result } = renderHook(() => ({ ...readTheme(), preference: useThemePreference() }), {
      wrapper,
    });

    expect(result.current.id).toBe('kinetic-volt');
    expect(result.current.preference).toBe('kinetic-volt');
  });

  it('lets the settings row win once it becomes readable', () => {
    setMirroredThemePreference('kinetic-volt');
    mockUseSettings.mockReturnValue({ isLoading: false, theme: 'kinetic-blush' });

    const { result } = renderHook(readTheme, { wrapper });

    expect(result.current.id).toBe('kinetic-blush');
  });

  it('follows the system preference and republishes the matching web variables', () => {
    mockSystemColorScheme = 'light';

    const { result } = renderHook(readTheme, { wrapper });

    expect(result.current.id).toBe('kinetic-light');
    expect(result.current.mode).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--c-bg-primary')).toBe(
      themeCssVariables['kinetic-light']['--c-bg-primary']
    );
    expect(mockColorSchemeSet).toHaveBeenCalledWith('light');
  });

  it('keeps scoped inline and NativeWind themes together without changing the root preference', () => {
    mockUseSettings.mockReturnValue({ theme: 'kinetic-light' });
    const scopedWrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        ThemeProvider,
        null,
        createElement(ThemeScope, { themeId: 'kinetic-depth' }, children)
      );

    const { result } = renderHook(readTheme, { wrapper: scopedWrapper });

    expect(result.current.id).toBe('kinetic-depth');
    expect(result.current.mode).toBe('dark');
    expect(result.current.theme.colors.background.primary).toBe('#091310');
  });

  it('leaves the root-level web variables in place when the provider unmounts', () => {
    const { unmount } = renderHook(readTheme, { wrapper });
    const published = document.documentElement.style.getPropertyValue('--c-bg-primary');
    expect(published).not.toBe('');

    unmount();

    // Removing them would drop the page back to the Tailwind defaults mid-session,
    // which on web means every unthemed surface flashes the light palette.
    expect(document.documentElement.style.getPropertyValue('--c-bg-primary')).toBe(published);
    expect(mockColorSchemeSet).toHaveBeenLastCalledWith('system');
  });
});
