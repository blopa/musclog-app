import { ReactNode } from 'react';
import { Dimensions, StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SCREEN_WIDTH = Dimensions.get('window').width;
// Match iOS's native edge-swipe zone (~20pt from the left edge)
const EDGE_ZONE_WIDTH = 20;

type Props = {
  onClose: () => void;
  enabled: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

export function SwipeToReturnWrapper({
  onClose,
  enabled,
  children,
  style,
  className,
  pointerEvents,
}: Props) {
  const translateX = useSharedValue(0);
  // Track whether the current gesture started within the left edge zone
  const isEdgeGesture = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .activeOffsetX([20, Infinity])
    .failOffsetY([-15, 15])
    .hitSlop({ left: 0, width: EDGE_ZONE_WIDTH })
    .enabled(enabled)
    .onStart((e) => {
      isEdgeGesture.value = e.x <= EDGE_ZONE_WIDTH;
    })
    .onUpdate((e) => {
      if (isEdgeGesture.value && e.translationX > 0) {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (isEdgeGesture.value && (e.translationX > SCREEN_WIDTH * 0.35 || e.velocityX > 800)) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, () => {
          runOnJS(onClose)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
      isEdgeGesture.value = false;
    });

  // Allow native scroll gestures (ScrollView) to run simultaneously with the
  // pan gesture so the pan never blocks vertical scrolling.
  const combinedGesture = Gesture.Simultaneous(panGesture, Gesture.Native());

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View
        className={className}
        pointerEvents={pointerEvents}
        style={[animatedStyle, style]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
