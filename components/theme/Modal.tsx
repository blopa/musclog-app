import type { ReactNode } from 'react';
import { Modal as RNModal } from 'react-native';

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
      {children}
    </RNModal>
  );
}
