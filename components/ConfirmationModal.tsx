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
  maxWidth,
}: ConfirmationModalProps) {
  // Default maxWidth is 30% larger than 320px (416px)
  const modalMaxWidth = maxWidth || theme.components.modal.confirmationMaxWidth;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getConfirmButtonStyle = () => {
    switch (variant) {
      case 'destructive':
        return {
          backgroundColor: theme.colors.status.error,
          ...theme.shadows.error,
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

  // Use backdrop overlay color from theme
  const backdropColor = theme.colors.overlay.backdrop;

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
        style={{ backgroundColor: backdropColor }}
        onPress={onClose}>
        {/* Modal */}
        <Pressable
          className="w-full border border-border-dark"
          style={{
            backgroundColor: theme.colors.background.cardDark,
            maxWidth: modalMaxWidth,
            borderColor: theme.colors.border.accent,
            borderRadius: theme.borderRadius.xl,
          }}
          onPress={(e) => e.stopPropagation()}>
          {/* Content */}
          <View
            className="gap-6"
            style={{
              padding: theme.spacing.padding['2xl'],
            }}>
            {/* Title and Message */}
            <View style={{ gap: theme.spacing.gap.md }}>
              <Text
                className="font-bold tracking-tight text-text-primary"
                style={{ fontSize: theme.typography.fontSize.lg }}>
                {title}
              </Text>
              <Text
                className="leading-relaxed"
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.text.secondary,
                }}>
                {message}
              </Text>
            </View>

            {/* Buttons */}
            <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
              <Pressable
                className="flex-1"
                style={{
                  backgroundColor: theme.colors.overlay.white20,
                  borderRadius: theme.borderRadius.lg,
                  paddingVertical: theme.spacing.padding.base,
                }}
                onPress={onClose}>
                <Text
                  className="text-center"
                  style={{
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.semibold,
                    color: theme.colors.text.secondary,
                  }}>
                  {cancelLabel}
                </Text>
              </Pressable>
              <Pressable
                className="flex-1"
                style={{
                  ...getConfirmButtonStyle(),
                  borderRadius: theme.borderRadius.lg,
                  paddingVertical: theme.spacing.padding.base,
                }}
                onPress={handleConfirm}>
                <Text
                  className="text-center text-text-primary"
                  style={{
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.bold,
                  }}>
                  {confirmLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
