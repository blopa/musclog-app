import type { ReactNode } from 'react';
import { Modal as RNModal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

export type ShellAwareModalProps = {
  visible: boolean;
  children: ReactNode;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  onRequestClose?: () => void;
  onShow?: () => void;
  statusBarTranslucent?: boolean;
};

export function Modal({
  visible,
  children,
  transparent = false,
  animationType = 'none',
  onRequestClose,
  onShow,
  statusBarTranslucent,
}: ShellAwareModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onRequestClose}
      onShow={onShow}
      statusBarTranslucent={statusBarTranslucent}
    >
      {/* Both are required inside RNModal on iOS — the modal is a separate native
          window that doesn't inherit the app root's context:
          - GestureHandlerRootView: needed for RNGH gestures to coordinate with
            native scroll gestures (e.g. Gesture.Simultaneous + Gesture.Native).
          - SafeAreaProvider: needed so SafeAreaView/useSafeAreaInsets returns
            real insets instead of zero, preventing content behind the status bar. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>{children}</SafeAreaProvider>
      </GestureHandlerRootView>
    </RNModal>
  );
}
