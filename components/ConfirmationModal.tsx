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
  maxWidth = 320,
}: ConfirmationModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getConfirmButtonStyle = () => {
    switch (variant) {
      case 'destructive':
        return {
          backgroundColor: '#ef4444', // red-500
          shadowColor: '#ef4444',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 4,
        };
      case 'primary':
        return {
          backgroundColor: theme.colors.accent.primary,
        };
      default:
        return {
          backgroundColor: theme.colors.accent.primary,
        };
    }
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
        style={{ backgroundColor: 'rgba(17, 33, 26, 0.8)' }} // background-dark/80
        onPress={onClose}>
        {/* Modal */}
        <Pressable
          className="w-full rounded-xl border border-border-dark"
          style={{
            backgroundColor: theme.colors.background.cardDark, // card-dark
            maxWidth,
            borderColor: theme.colors.border.accent, // card-border
          }}
          onPress={(e) => e.stopPropagation()}>
          {/* Content */}
          <View className="gap-6 p-6">
            {/* Title and Message */}
            <View className="gap-2">
              <Text className="text-lg font-bold tracking-tight text-text-primary">{title}</Text>
              <Text
                className="text-sm leading-relaxed"
                style={{ color: theme.colors.text.secondary }}>
                {message}
              </Text>
            </View>

            {/* Buttons */}
            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 rounded-lg py-3"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }} // bg-white/5
                onPress={onClose}>
                <Text
                  className="text-center text-sm font-semibold"
                  style={{ color: theme.colors.text.secondary }}>
                  {cancelLabel}
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 rounded-lg py-3"
                style={getConfirmButtonStyle()}
                onPress={handleConfirm}>
                <Text className="text-center text-sm font-bold text-white">{confirmLabel}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
