/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

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
    expect(result.current.theme.colors.background.primary).toBe('#0d1210');
  });

  it('lets the mirror outrank a readable settings row when asked, as the website does', () => {
    // The website's write to the row can be lost before a slow database opens; the mirror holds
    // the newer choice (see `WebsiteThemeSync`).
    setMirroredThemePreference('kinetic-volt');
    mockUseSettings.mockReturnValue({ isLoading: false, theme: 'kinetic-blush' });
    const websiteWrapper = ({ children }: { children: ReactNode }) =>
      createElement(ThemeProvider, { preferMirror: true }, children);

    const { result } = renderHook(readTheme, { wrapper: websiteWrapper });

    expect(result.current.id).toBe('kinetic-volt');
  });

  it('renders no palette into static HTML on web, so the pre-paint script stays in charge', () => {
    // An inline palette on the provider's element outranks :root for the whole page, so every
    // statically served page showed the default theme until the bundle hydrated.
    setMirroredThemePreference('kinetic-volt');
    mockUseSettings.mockReturnValue({ isLoading: true, theme: 'system' });

    const html = renderToString(createElement(ThemeProvider, null, createElement('p', null, 'x')));

    expect(html).not.toMatch(/--c-[\w-]+\s*:/);
  });

  it('never publishes the default palette while hydrating a page painted from the mirror', async () => {
    setMirroredThemePreference('kinetic-volt');
    mockUseSettings.mockReturnValue({ isLoading: true, theme: 'system' });
    const tree = () => createElement(ThemeProvider, null, createElement('p', null, 'x'));
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree());
    document.body.appendChild(container);
    const setProperty = jest.spyOn(document.documentElement.style, 'setProperty');
    const setAttribute = jest.spyOn(document.documentElement, 'setAttribute');

    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree());
      });

      const backgrounds = setProperty.mock.calls
        .filter(([name]) => name === '--c-bg-primary')
        .map(([, value]) => value);
      expect(backgrounds).toEqual([themeCssVariables['kinetic-volt']['--c-bg-primary']]);
      expect(
        setAttribute.mock.calls.filter(([name]) => name === 'data-theme-id').map(([, id]) => id)
      ).toEqual(['kinetic-volt']);
    } finally {
      setProperty.mockRestore();
      setAttribute.mockRestore();
      act(() => root?.unmount());
      container.remove();
    }
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
