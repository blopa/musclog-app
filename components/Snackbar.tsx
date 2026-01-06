import { View, Text, Pressable, Animated, PanResponder } from 'react-native';
import { CheckCircle, AlertTriangle } from 'lucide-react-native';
import { useRef } from 'react';
import { theme } from '../theme';

export type SnackbarType = {
  id: number;
  type: 'success' | 'error';
  message: string;
  subtitle?: string;
  action: string;
};

type SnackbarProps = {
  snackbar: SnackbarType;
  onDismiss: (id: number) => void;
};

export function Snackbar({ snackbar, onDismiss }: SnackbarProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: 0 });
        // Update opacity based on swipe distance
        const newOpacity = 1 - Math.abs(gestureState.dx) / 200;
        opacity.setValue(Math.max(0, Math.min(1, newOpacity)));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 100) {
          // Swipe threshold met - dismiss
          Animated.parallel([
            Animated.timing(pan.x, {
              toValue: gestureState.dx > 0 ? 400 : -400,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => onDismiss(snackbar.id));
        } else {
          // Snap back to position
          Animated.parallel([
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const isSuccess = snackbar.type === 'success';

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        transform: [{ translateX: pan.x }],
        opacity,
      }}>
      <View
        className={`mx-4 mb-3 flex-row items-center gap-4 rounded-2xl p-4 ${
          isSuccess ? 'bg-[#0d3520]' : 'bg-[#3d1515]'
        }`}
        style={{
          borderLeftWidth: 5,
          borderLeftColor: isSuccess ? theme.colors.status.success : theme.colors.status.error,
          ...theme.shadows.lg,
        }}>
        {/* Icon */}
        <View
          className={`h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
            isSuccess ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
          }`}>
          {isSuccess ? (
            <CheckCircle size={24} color="#0d3520" />
          ) : (
            <AlertTriangle size={20} color="#ffffff" />
          )}
        </View>

        {/* Content */}
        <View className="min-w-0 flex-1">
          <Text className="font-semibold text-white">{snackbar.message}</Text>
          {snackbar.subtitle && (
            <Text className="mt-0.5 text-sm text-gray-400">{snackbar.subtitle}</Text>
          )}
        </View>

        {/* Action Button */}
        <Pressable
          onPress={() => onDismiss(snackbar.id)}
          className={`flex-shrink-0 rounded-lg px-3 py-1 ${
            isSuccess ? 'active:bg-[#22c55e]/10' : 'active:bg-red-500/10'
          }`}>
          <Text className={`text-sm font-bold ${isSuccess ? 'text-[#22c55e]' : 'text-red-500'}`}>
            {snackbar.action}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
