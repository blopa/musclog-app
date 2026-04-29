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

  const panGesture = Gesture.Pan()
    // Only activate on rightward drags; fail if the user scrolls vertically
    .activeOffsetX([20, Infinity])
    .failOffsetY([-15, 15])
    .enabled(enabled)
    .onUpdate((e) => {
      if (e.translationX > 0) {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (e.translationX > SCREEN_WIDTH * 0.35 || e.velocityX > 800) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, () => {
          runOnJS(onClose)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
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
