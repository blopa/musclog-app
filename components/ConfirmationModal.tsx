import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { theme } from '../theme';

export type ConfirmationModalVariant = 'destructive' | 'primary' | 'default';

type ConfirmationModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmationModalVariant;
  maxWidth?: number;
};

export function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'default',
  maxWidth = 384,
}: ConfirmationModalProps) {
  const getConfirmButtonStyle = () => {
    switch (variant) {
      case 'destructive':
        return 'bg-status-error';
      case 'primary':
        return 'bg-accent-primary';
      default:
        return 'bg-accent-primary';
    }
  };

  const getConfirmTextStyle = () => {
    switch (variant) {
      case 'destructive':
      case 'primary':
        return 'text-text-black';
      default:
        return 'text-text-primary';
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Backdrop */}
      <Pressable
        className="flex-1 items-center justify-center p-4"
        style={{ backgroundColor: theme.colors.overlay.black60 }}
        onPress={onClose}>
        {/* Modal */}
        <Pressable
          className="w-full overflow-hidden rounded-xl border border-border-dark"
          style={{
            backgroundColor: theme.colors.background.cardElevated,
            maxWidth,
          }}
          onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View className="border-b border-border-dark bg-bg-overlay/50 px-6 py-5">
            <Text className="text-xl font-bold text-text-primary">{title}</Text>
            <Text className="mt-2 text-sm text-text-secondary">{message}</Text>
          </View>

          {/* Footer */}
          <View className="flex-row gap-3 border-t border-border-dark bg-bg-overlay/50 px-6 py-4">
            <Pressable
              className="flex-1 rounded-lg border border-border-light bg-bg-card py-3"
              onPress={onClose}>
              <Text className="text-center text-sm font-bold uppercase tracking-wide text-text-primary">
                {cancelLabel}
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 rounded-lg py-3 ${getConfirmButtonStyle()}`}
              onPress={handleConfirm}>
              <Text
                className={`text-center text-sm font-bold uppercase tracking-wide ${getConfirmTextStyle()}`}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
