import { LinearGradient } from 'expo-linear-gradient';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { Button } from '../theme/Button';

export type ConfirmationModalVariant = 'destructive' | 'primary' | 'default';

type ConfirmationModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmationModalVariant;
  maxWidth?: number;
  isLoading?: boolean;
  warning?: string | null;
};

export function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  maxWidth,
  isLoading = false,
  warning,
}: ConfirmationModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const defaultCancelLabel = cancelLabel || t('common.cancel');
  // Default maxWidth is 30% larger than 320px (416px)
  const modalMaxWidth = maxWidth || theme.size['400'];

  const handleConfirm = useCallback(async () => {
    if (isLoading) {
      return;
    }

    await Promise.resolve(onConfirm());
    onClose();
  }, [isLoading, onClose, onConfirm]);

  const getConfirmButtonVariant = (): 'accent' | 'discard' => {
    return variant === 'destructive' ? 'discard' : 'accent';
  };

  // Use backdrop overlay color from theme
  const backdropColor = theme.colors.overlay.backdrop;

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
        style={[{ backgroundColor: backdropColor }, webBackdropStyle]}
        onPress={isLoading ? undefined : onClose}
      >
        {/* Modal */}
        <Pressable
          className="w-full overflow-hidden border border-border-dark"
          style={{
            backgroundColor: theme.colors.background.secondaryDark,
            maxWidth: modalMaxWidth,
            borderColor: theme.colors.border.accent,
            borderRadius: theme.borderRadius.xl,
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
            <View
              style={{
                padding: theme.spacing.padding['2xl'],
                paddingBottom: theme.spacing.padding.lg,
              }}
            >
              <Text
                className="font-bold tracking-tight text-text-primary"
                style={{ fontSize: theme.typography.fontSize.lg }}
              >
                {title}
              </Text>
            </View>
          </LinearGradient>

          {/* Content */}
          <View
            className="gap-6"
            style={{
              padding: theme.spacing.padding['2xl'],
            }}
          >
            {/* Message */}
            <Text
              className="leading-relaxed"
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.secondary,
              }}
            >
              {message}
            </Text>

            {/* Warning */}
            {warning ? (
              <View
                className="rounded-lg border-l-4 p-3"
                style={{
                  backgroundColor: `${theme.colors.status.warning}10`,
                  borderColor: theme.colors.status.warning,
                  borderLeftWidth: 4,
                }}
              >
                <Text
                  className="text-sm font-medium leading-relaxed"
                  style={{
                    color: theme.colors.status.warning,
                  }}
                >
                  {warning}
                </Text>
              </View>
            ) : null}

            {/* Buttons */}
            <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
              <Button
                label={defaultCancelLabel}
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={onClose}
                disabled={isLoading}
              />
              <Button
                label={confirmLabel}
                variant={getConfirmButtonVariant()}
                size="sm"
                width="flex-1"
                onPress={handleConfirm}
                disabled={isLoading}
                loading={isLoading}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
