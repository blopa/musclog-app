import React, { ReactNode } from 'react';
import { View, Text, Pressable, Modal, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { theme } from '../theme';

type CenteredModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
};

export function CenteredModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = theme.components.modal.defaultMaxWidth, // max-w-sm equivalent
}: CenteredModalProps) {
  // Web-specific styles for proper viewport positioning
  const webBackdropStyle = Platform.OS === 'web' 
    ? ({
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      } as any)
    : {};

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      {/* Backdrop */}
      <Pressable
        className="flex-1 items-center justify-center p-4"
        style={[
          { backgroundColor: theme.colors.overlay.black60 },
          webBackdropStyle,
        ]}
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
          <View className="flex-row items-center justify-between border-b border-border-dark bg-bg-overlay/50 px-6 py-5">
            <View className="flex-1">
              <Text className="text-xl font-bold text-text-primary">{title}</Text>
              {subtitle && (
                <Text className="mt-1 text-xs font-medium text-text-secondary">{subtitle}</Text>
              )}
            </View>
            <Pressable className="h-10 w-10 items-center justify-center" onPress={onClose}>
              <X size={theme.iconSize.sm} color={theme.colors.text.secondary} />
            </Pressable>
          </View>

          {/* Content */}
          <View className="p-6">{children}</View>

          {/* Footer */}
          {footer && (
            <View className="border-t border-border-dark bg-bg-overlay/50 px-6 py-4">{footer}</View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
