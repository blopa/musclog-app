/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import type { ReactElement } from 'react';

import { LoggyPose } from '@/components/LoggyPose';
import { useLoggyColors } from '@/components/loggy/useLoggyColors';
import type { ThemeId } from '@/constants/settings';
import { useThemeIdOrNull } from '@/hooks/useTheme';

const { LOGGY_CLASSIC, LOGGY_COLORS_BY_THEME } = require('../../constants/loggyTheme') as {
  LOGGY_CLASSIC: Record<string, string>;
  LOGGY_COLORS_BY_THEME: Record<string, Record<string, string>>;
};

jest.mock('@/hooks/useTheme', () => ({ useThemeIdOrNull: jest.fn() }));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ showLoggy: true, animatedLoggy: false }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
  useReducedMotion: () => false,
}));

function inTheme(themeId: ThemeId | null) {
  jest.mocked(useThemeIdOrNull).mockReturnValue(themeId);
}

describe('useLoggyColors', () => {
  it.each(Object.keys(LOGGY_COLORS_BY_THEME))('follows %s', (themeId) => {
    inTheme(themeId as ThemeId);

    expect(renderHook(() => useLoggyColors()).result.current).toBe(LOGGY_COLORS_BY_THEME[themeId]);
  });

  it('is the classic green outside a theme provider', () => {
    inTheme(null);

    expect(renderHook(() => useLoggyColors()).result.current).toBe(LOGGY_CLASSIC);
  });

  it('stays classic when asked, whatever the theme', () => {
    inTheme('kinetic-shock');

    expect(renderHook(() => useLoggyColors('classic')).result.current).toBe(LOGGY_CLASSIC);
  });
});

describe('LoggyPose colours', () => {
  function art(
    props: Parameters<typeof LoggyPose>[0]
  ): ReactElement<{ colors: unknown; clock?: unknown }> {
    return renderHook(() => LoggyPose(props)).result.current as ReactElement<{
      colors: unknown;
      clock?: unknown;
    }>;
  }

  it('paints the still in the theme’s greens', () => {
    inTheme('kinetic-shock');

    const element = art({ pose: 'wave', height: 100, animated: false });

    expect(element.props.colors).toBe(LOGGY_COLORS_BY_THEME['kinetic-shock']);
    expect(element.props.clock).toBeUndefined();
  });

  it('paints the animation in them too', () => {
    inTheme('kinetic-scope');

    const element = art({ pose: 'wave', height: 100, animated: true });

    expect(element.props.colors).toBe(LOGGY_COLORS_BY_THEME['kinetic-scope']);
  });

  it('keeps a poster’s Loggy classic under any theme', () => {
    inTheme('kinetic-varia');

    expect(art({ pose: 'wave', height: 100, appearance: 'classic' }).props.colors).toBe(
      LOGGY_CLASSIC
    );
  });
});
