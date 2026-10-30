import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView as RNScrollView,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';

import { hidesContentToTheRight } from '@/components/workout/session/scrollOverflow';
import { useSurfaceColor } from '@/context/SurfaceColorContext';
import { useTheme } from '@/hooks/useTheme';

/** Width of the edge fade that signals more tabs past the right edge. */
const EDGE_FADE_WIDTH = 32;

// iOS: RNGH ScrollView fights SwipeToReturnWrapper's pan gesture; RN's native UIScrollView is covered by Gesture.Native() and wins correctly.
const ScrollView = Platform.OS === 'ios' ? RNScrollView : GHScrollView;

type FilterTab = {
  id: string;
  label: string;
};

type FilterTabsProps = {
  tabs: FilterTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  containerClassName?: string;
  scrollViewContentContainerStyle?: ViewStyle;
  showContainer?: boolean;
  withCheckmark?: boolean;
  inactiveTextColor?: string;
  inactiveBackgroundColor?: string;
};

export function FilterTabs({
  tabs,
  activeTab,
  onTabChange,
  containerClassName,
  scrollViewContentContainerStyle,
  showContainer = true,
  withCheckmark = false,
  inactiveTextColor,
  inactiveBackgroundColor,
}: FilterTabsProps) {
  const theme = useTheme();
  const surface = useSurfaceColor();
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const moreToTheRight = hidesContentToTheRight(viewportWidth, contentWidth, offsetX);
  const scroller = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      onContentSizeChange={(width) => setContentWidth(width)}
      onScroll={(event) => setOffsetX(event.nativeEvent.contentOffset.x)}
      scrollEventThrottle={32}
      contentContainerStyle={
        scrollViewContentContainerStyle || { paddingHorizontal: theme.spacing.padding.xl }
      }
      className="flex-row"
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;

        return (
          <Pressable
            key={tab.id}
            // Same geometry as `Chip`: 36pt drawn, padded out to the 44pt target.
            hitSlop={4}
            className={`min-h-9 flex-row items-center rounded-control border px-4 ${
              isActive
                ? 'border-transparent bg-accent-primary'
                : 'border-border-light bg-bg-filterTab'
            }`}
            style={{
              marginRight: index < tabs.length - 1 ? theme.spacing.gap.sm : 0,
              ...(isActive || !inactiveBackgroundColor
                ? undefined
                : { backgroundColor: inactiveBackgroundColor }),
            }}
            onPress={() => onTabChange(tab.id)}
            {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
          >
            <Text
              className="text-sm font-medium"
              style={{
                color: isActive
                  ? theme.colors.text.onAccent
                  : (inactiveTextColor ?? theme.colors.text.secondary),
              }}
            >
              {tab.label}
            </Text>
            {isActive && withCheckmark ? (
              <Check
                size={theme.iconSize.sm}
                color={theme.colors.text.onAccent}
                style={{ marginLeft: theme.spacing.margin['1half'] }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
  // A cut-off tab alone does not say "this scrolls", so an edge fade shows while tabs are hidden.
  const content = (
    <View>
      {scroller}
      {moreToTheRight ? (
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: EDGE_FADE_WIDTH }}
        />
      ) : null}
    </View>
  );

  if (!showContainer) {
    return content;
  }

  return <View className={containerClassName || 'mb-4'}>{content}</View>;
}
