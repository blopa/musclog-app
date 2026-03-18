import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

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
  maxWidth,
}: CenteredModalProps) {
  const theme = useTheme();
  // Web-specific styles for proper viewport positioning
  const webBackdropStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
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
        style={[{ backgroundColor: theme.colors.overlay.black60 }, webBackdropStyle]}
        onPress={onClose}
      >
        {/* Modal */}
        <Pressable
          className="w-full overflow-hidden rounded-xl border border-border-dark"
          style={{
            backgroundColor: theme.colors.background.cardElevated,
            maxWidth: maxWidth || theme.size['384'],
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Gradient Header */}
          <LinearGradient
            colors={[theme.colors.status.purple40, theme.colors.accent.secondary10, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderBottomWidth: theme.borderWidth.thin,
              borderBottomColor: theme.colors.border.dark,
            }}
          >
            <View className="flex-row items-center justify-between px-4 py-5">
              <View className="flex-1">
                <Text className="text-xl font-bold text-text-primary">{title}</Text>
                {subtitle ? (
                  <Text className="mt-1 text-xs font-medium text-text-secondary">{subtitle}</Text>
                ) : null}
              </View>
              <Pressable className="h-10 w-10 items-center justify-center" onPress={onClose}>
                <X size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              </Pressable>
            </View>
          </LinearGradient>

          {/* Content */}
          <View className="p-6">{children}</View>

          {/* Footer */}
          {footer ? (
            <View className="border-t border-border-dark bg-bg-overlay/50 px-4 py-4">{footer}</View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
