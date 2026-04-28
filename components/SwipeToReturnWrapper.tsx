import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

type Props = {
  onClose: () => void;
  enabled: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

// No-op on Android and Web — swipe-back is handled natively on those platforms.
export function SwipeToReturnWrapper({ children, style, className, pointerEvents }: Props) {
  return (
    <View className={className} pointerEvents={pointerEvents} style={style}>
      {children}
    </View>
  );
}
