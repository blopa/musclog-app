import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Modal } from '@/components/theme/Modal';
import { useTheme } from '@/hooks/useTheme';
import { useWebModalLayerStyle } from '@/utils/webPhoneFrame';

type CenteredModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  /** When true, backdrop, X, and Android back do not dismiss the modal. */
  isLoading?: boolean;
};

export function CenteredModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth,
  isLoading = false,
}: CenteredModalProps) {
  const theme = useTheme();
  const webBackdropStyle = useWebModalLayerStyle({ variant: 'centered' });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isLoading ? () => {} : onClose}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      {/* Root fills the screen; backdrop tap is a sibling behind the sheet so ScrollView inside the sheet can scroll on native (Pressable ancestors steal pan gestures). */}
      <View
        className="flex-1"
        style={[{ backgroundColor: theme.colors.overlay.black60 }, webBackdropStyle]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={isLoading ? undefined : onClose} />
        <View className="flex-1 items-center justify-center p-4" pointerEvents="box-none">
          <View
            className="border-border-dark w-full overflow-hidden rounded-xl border"
            style={{
              backgroundColor: theme.colors.background.cardElevated,
              maxWidth: maxWidth || theme.size['384'],
            }}
          >
            {/* Gradient Header */}
            <LinearGradient
              colors={[
                theme.colors.status.purple40,
                theme.colors.accent.secondary10,
                'transparent',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderBottomWidth: theme.borderWidth.thin,
                borderBottomColor: theme.colors.border.dark,
              }}
            >
              <View className="flex-row items-center justify-between px-4 py-5">
                <View className="flex-1">
                  <Text className="text-text-primary text-xl font-bold">{title}</Text>
                  {subtitle ? (
                    <Text className="text-text-secondary mt-1 text-xs font-medium">{subtitle}</Text>
                  ) : null}
                </View>
                <Pressable
                  className="h-10 w-10 items-center justify-center"
                  onPress={isLoading ? undefined : onClose}
                  disabled={isLoading}
                >
                  <X size={theme.iconSize.sm} color={theme.colors.text.secondary} />
                </Pressable>
              </View>
            </LinearGradient>

            {/* Content */}
            <View className="p-6">{children}</View>

            {/* Footer */}
            {footer ? (
              <View className="border-border-dark bg-bg-overlay/50 border-t px-4 py-4">
                {footer}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
