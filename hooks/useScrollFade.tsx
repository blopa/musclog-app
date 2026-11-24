import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown } from 'lucide-react-native';
import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScrollViewInstance } from 'react-native';
import { TouchableOpacity } from 'react-native';

import { useSurfaceColor } from '@/context/SurfaceColorContext';

import { useTheme } from './useTheme';

/**
 * How loud the cue is. `full` (a tall fade and a 44pt chevron disc) suits a screen whose whole point
 * is below the fold (the paywall, the What's new tour). `subtle` (a short fade and a small chevron)
 * suits a form whose last field merely slips under a pinned footer button (Log meal, Track food).
 */
export type ScrollCueVariant = 'full' | 'subtle';

const CUE_LOOK: Record<
  ScrollCueVariant,
  { fade: number; disc: number; icon: number; bottom: number; opacity: number }
> = {
  full: { fade: 80, disc: 44, icon: 22, bottom: 12, opacity: 0.6 },
  subtle: { fade: 32, disc: 24, icon: 16, bottom: 4, opacity: 0.5 },
};

/**
 * A vertical scroller's "there is more below" cue: a fade into the surface the scroller sits on
 * (never a fixed scrim, which turned the bottom of a light theme dark) and a chevron that scrolls
 * to the end. Spread `scrollProps` on the ScrollView, render `FadeIndicator` over it, and use the
 * returned `scrollRef` for any scrolling of your own. A scroller whose ref the caller already owns
 * passes it in, so the chevron scrolls that one.
 */
export function useScrollFade(
  externalRef?: RefObject<ScrollViewInstance | null>,
  variant: ScrollCueVariant = 'full'
) {
  const { t } = useTranslation();
  const theme = useTheme();
  const look = CUE_LOOK[variant];
  const slop = (44 - look.disc) / 2;
  const surface = useSurfaceColor();
  const ownRef = useRef<ScrollViewInstance>(null);
  const scrollRef = externalRef ?? ownRef;
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const layoutHeightRef = useRef(0);
  const contentHeightRef = useRef(0);

  const checkScrollable = () => {
    setIsScrollable(contentHeightRef.current > layoutHeightRef.current + 8);
  };

  const scrollProps = {
    ref: scrollRef,
    onLayout: ({ nativeEvent }: { nativeEvent: any }) => {
      layoutHeightRef.current = nativeEvent.layout.height;
      checkScrollable();
    },
    onContentSizeChange: (_w: number, h: number) => {
      contentHeightRef.current = h;
      checkScrollable();
    },
    onScroll: ({ nativeEvent }: { nativeEvent: any }) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      setIsAtBottom(contentOffset.y + layoutMeasurement.height >= contentSize.height - 8);
    },
    scrollEventThrottle: 16,
  };

  const FadeIndicator =
    isScrollable && !isAtBottom ? (
      <>
        <LinearGradient
          colors={['transparent', surface]}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: look.fade,
            pointerEvents: 'none',
          }}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('common.a11y.scrollDown')}
          onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
          // A small disc keeps a full-size touch target, except downwards, where the cue ends on
          // the footer's button and must not take its taps.
          hitSlop={{ top: slop, left: slop, right: slop, bottom: Math.min(slop, look.bottom) }}
          style={{
            position: 'absolute',
            bottom: look.bottom,
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            width: look.disc,
            height: look.disc,
            borderRadius: look.disc / 2,
            backgroundColor: theme.colors.background.ink10,
            borderWidth: 1,
            borderColor: theme.colors.background.ink10,
            opacity: look.opacity,
          }}
        >
          <ChevronDown size={look.icon} color={theme.colors.text.primary} strokeWidth={2} />
        </TouchableOpacity>
      </>
    ) : null;

  return { scrollProps, FadeIndicator, scrollRef };
}
