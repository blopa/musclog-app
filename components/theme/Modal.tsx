import type { ReactNode } from 'react';
import { Modal as RNModal, type ModalProps } from 'react-native';

export type ShellAwareModalProps = {
  visible: boolean;
  children: ReactNode;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  onRequestClose?: () => void;
  onShow?: () => void;
  statusBarTranslucent?: boolean;
  presentationStyle?: ModalProps['presentationStyle'];
};

export function Modal({
  visible,
  children,
  transparent = false,
  animationType = 'none',
  onRequestClose,
  onShow,
  statusBarTranslucent,
  presentationStyle,
}: ShellAwareModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onRequestClose}
      onShow={onShow}
      statusBarTranslucent={statusBarTranslucent}
      presentationStyle={presentationStyle}
    >
      {children}
    </RNModal>
  );
}
