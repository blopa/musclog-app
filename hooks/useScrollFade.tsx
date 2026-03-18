import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';

import { theme } from '../theme';

export function useScrollFade() {
  const scrollRef = useRef<ScrollView>(null);
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
          colors={['transparent', theme.colors.overlay.backdrop90]}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            pointerEvents: 'none',
          }}
        />
        <TouchableOpacity
          onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
          style={{
            position: 'absolute',
            bottom: 12,
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.colors.background.white10,
            borderWidth: 1,
            borderColor: theme.colors.background.white10,
            opacity: 0.6,
          }}
        >
          <ChevronDown size={22} color={theme.colors.text.white} strokeWidth={2} />
        </TouchableOpacity>
      </>
    ) : null;

  return { scrollProps, FadeIndicator };
}
