/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { ThemeProvider, ThemeScope } from '@/context/ThemeContext';
import { useSettings } from '@/hooks/useSettings';
import { useTheme, useThemeId, useThemeMode } from '@/hooks/useTheme';
import { themeCssVariables } from '@/theme.tokens';

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
    expect(mockUseSettings).toHaveBeenCalledTimes(1);
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

  it('removes root-level web overrides when the provider unmounts', () => {
    const { unmount } = renderHook(readTheme, { wrapper });
    expect(document.documentElement.style.getPropertyValue('--c-bg-primary')).not.toBe('');

    unmount();

    expect(document.documentElement.style.getPropertyValue('--c-bg-primary')).toBe('');
    expect(mockColorSchemeSet).toHaveBeenLastCalledWith('system');
  });
});
