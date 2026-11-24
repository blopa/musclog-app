/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { SurfaceColorProvider } from '@/context/SurfaceColorContext';
import { useScrollFade } from '@/hooks/useScrollFade';

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: () => null,
}));

jest.mock('lucide-react-native', () => ({
  ChevronDown: () => null,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/theme', () => ({
  addOpacityToHex: jest.requireActual('@/theme.tokens').addOpacityToHex,
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: { ink10: '#112233' },
      text: { primary: '#ffffff' },
    },
  }),
}));

const SURFACE = '#1a2b3c';
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SurfaceColorProvider, { color: SURFACE }, children);

describe('useScrollFade', () => {
  it('uses addOpacityToHex(surface, 0) instead of transparent for the gradient start stop', () => {
    const { result } = renderHook(() => useScrollFade(), { wrapper });

    act(() => {
      result.current.scrollProps.onLayout({ nativeEvent: { layout: { height: 200 } } });
      result.current.scrollProps.onContentSizeChange(300, 600);
    });

    const indicator = result.current.FadeIndicator as any;
    const gradientProps = indicator.props.children[0].props;
    expect(gradientProps.colors).toEqual(['rgba(26, 43, 60, 0)', SURFACE]);
  });

  it('recomputes isAtBottom on onLayout and onContentSizeChange as well as onScroll', () => {
    const { result } = renderHook(() => useScrollFade(), { wrapper });

    // Content overflows initially -> cue is shown.
    act(() => {
      result.current.scrollProps.onLayout({ nativeEvent: { layout: { height: 200 } } });
      result.current.scrollProps.onContentSizeChange(300, 500);
    });
    expect(result.current.FadeIndicator).not.toBeNull();

    // Scroll to the bottom -> cue hides.
    act(() => {
      result.current.scrollProps.onScroll({
        nativeEvent: {
          layoutMeasurement: { height: 200 },
          contentOffset: { y: 300 },
          contentSize: { height: 500 },
        },
      });
    });
    expect(result.current.FadeIndicator).toBeNull();

    // Content grows while scroll offset stays at 300 -> no longer at bottom, cue reappears.
    act(() => {
      result.current.scrollProps.onContentSizeChange(300, 700);
    });
    expect(result.current.FadeIndicator).not.toBeNull();

    // Container grows enough to show up to the end -> at bottom again, cue hides.
    act(() => {
      result.current.scrollProps.onLayout({ nativeEvent: { layout: { height: 400 } } });
    });
    expect(result.current.FadeIndicator).toBeNull();
  });
});
