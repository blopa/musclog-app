import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Modal as RNModal, type ModalProps } from 'react-native';

let modalCounter = 0;
const activeModals = new Set<string>();

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

function getCallerName(): string {
  try {
    const err = new Error();
    const stack = err.stack?.split('\n') || [];
    // Find the first line that's not from Modal.tsx
    for (const line of stack) {
      if (!line.includes('Modal.tsx') && line.includes('at ')) {
        // Extract component/function name from stack trace
        const match = line.match(/at\s+(\w+)/);
        if (match) {
          return match[1];
        }
      }
    }
  } catch {
    // ignore
  }
  return 'unknown';
}

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
  const instanceId = useRef<string>(`modal-${++modalCounter}`);
  const callerName = useRef<string>(getCallerName());

  useEffect(() => {
    const id = instanceId.current;
    const caller = callerName.current;
    if (visible) {
      activeModals.add(id);
      console.log(`[Modal:${id}] VISIBLE (caller: ${caller}), active modals: ${activeModals.size}`);
    } else {
      activeModals.delete(id);
      console.log(`[Modal:${id}] HIDDEN (caller: ${caller}), active modals: ${activeModals.size}`);
    }
    return () => {
      activeModals.delete(id);
    };
  }, [visible]);

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
