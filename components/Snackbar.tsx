import { AlertTriangle, CheckCircle } from 'lucide-react-native';
import { useRef } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { SnackbarOptions } from '@/utils/snackbarService';

export type SnackbarType = {
  id: number;
  type: 'success' | 'error';
  message: string;
  action: string;
} & Pick<SnackbarOptions, 'subtitle' | 'onAction' | 'secondaryAction' | 'onSecondaryAction'>;

type SnackbarProps = {
  snackbar: SnackbarType;
  onDismiss: (id: number) => void;
};

export function Snackbar({ snackbar, onDismiss }: SnackbarProps) {
  const theme = useTheme();
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

  const handleActionPress = (callback?: () => void) => {
    callback?.();
    onDismiss(snackbar.id);
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        transform: [{ translateX: pan.x }],
        opacity,
      }}
    >
      <View
        className="mx-4 mb-3 flex-row items-center gap-4 rounded-2xl p-4"
        style={{
          backgroundColor: isSuccess
            ? theme.colors.background.snackbarSuccess
            : theme.colors.background.snackbarError,
          borderLeftWidth: theme.borderWidth.accent,
          borderLeftColor: isSuccess ? theme.colors.status.success : theme.colors.status.error,
          ...theme.shadows.lg,
        }}
      >
        {/* Icon */}
        <View
          className="h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: isSuccess ? theme.colors.status.success : theme.colors.status.error,
          }}
        >
          {isSuccess ? (
            <CheckCircle size={theme.iconSize.xl} color={theme.colors.background.snackbarSuccess} />
          ) : (
            <AlertTriangle size={theme.iconSize.lg} color={theme.colors.text.white} />
          )}
        </View>

        {/* Content */}
        <View className="min-w-0 flex-1">
          <Text className="font-semibold" style={{ color: theme.colors.text.white }}>
            {snackbar.message}
          </Text>
          {snackbar.subtitle ? (
            <Text className="mt-0.5 text-sm" style={{ color: theme.colors.text.secondary }}>
              {snackbar.subtitle}
            </Text>
          ) : null}
        </View>

        {/* Action Button */}
        <View className="flex-shrink-0 flex-row flex-wrap items-center justify-end gap-2">
          {snackbar.secondaryAction ? (
            <Pressable
              onPress={() => handleActionPress(snackbar.onSecondaryAction)}
              className="rounded-lg px-3 py-1"
              style={{
                backgroundColor: 'transparent',
                opacity: 0.82,
              }}
            >
              <Text className="text-sm font-medium" style={{ color: theme.colors.text.white }}>
                {snackbar.secondaryAction}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => handleActionPress(snackbar.onAction)}
            className="rounded-lg px-3 py-1"
            style={{
              backgroundColor: 'transparent',
            }}
          >
            <Text
              className="text-sm font-bold"
              style={{
                color: isSuccess ? theme.colors.status.success : theme.colors.status.error,
              }}
            >
              {snackbar.action}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
