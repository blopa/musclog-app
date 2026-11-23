import { type ReactNode, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { Modal } from '@/components/theme/Modal';
import { SurfaceColorProvider } from '@/context/SurfaceColorContext';
import { useScrollFade } from '@/hooks/useScrollFade';
import { useTheme } from '@/hooks/useTheme';
import { useWebModalLayerStyle } from '@/utils/webPhoneFrame';

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
  /**
   * For a message that can outgrow a short window (a long translation, large text, a small phone):
   * the dialog is bounded to the window and only the message scrolls, so the title and both buttons
   * stay on screen.
   */
  scrollable?: boolean;
};

/**
 * A message that outgrew the dialog: it scrolls between the title and the buttons, with the shared
 * "there is more below" cue (a fade into the dialog's own surface and a chevron that scrolls to the
 * end) so text running under the buttons never looks cut off. Rendered inside the dialog's
 * `SurfaceColorProvider`, so the fade matches its background.
 */
function ScrollableMessage({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { scrollProps, FadeIndicator } = useScrollFade();

  return (
    <View style={{ flexShrink: 1 }}>
      <ScrollView style={{ flexShrink: 1 }} testID="confirmation-modal-scroll" {...scrollProps}>
        <View
          className="gap-6"
          style={{
            padding: theme.spacing.padding['2xl'],
            paddingBottom: theme.spacing.padding.lg,
          }}
        >
          {children}
        </View>
      </ScrollView>
      {FadeIndicator}
    </View>
  );
}

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
  scrollable = false,
}: ConfirmationModalProps) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
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

  const webBackdropStyle = useWebModalLayerStyle({ variant: 'centered' });

  const messageBlock = (
    <>
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
          className="rounded-control border-l-4 p-3"
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
    </>
  );

  // Wraps: a long translation of either label stacks the two instead of breaking a word.
  const buttons = (
    <View className="flex-row flex-wrap" style={{ gap: theme.spacing.gap.md }}>
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
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isLoading ? () => {} : onClose}
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
            // The backdrop pads the dialog by 16 on each side (p-4).
            maxHeight: scrollable ? windowHeight - 32 : undefined,
            borderColor: theme.colors.border.accent,
            borderRadius: theme.borderRadius.xl,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <SurfaceColorProvider color={theme.colors.background.secondaryDark}>
            {/* Header */}
            <View
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
                  className="font-bold text-text-primary"
                  style={{ fontSize: theme.typography.fontSize.lg }}
                >
                  {title}
                </Text>
              </View>
            </View>

            {/* Content */}
            {scrollable ? (
              <>
                <ScrollableMessage>{messageBlock}</ScrollableMessage>
                <View
                  style={{
                    paddingHorizontal: theme.spacing.padding['2xl'],
                    paddingBottom: theme.spacing.padding['2xl'],
                  }}
                >
                  {buttons}
                </View>
              </>
            ) : (
              <View className="gap-6" style={{ padding: theme.spacing.padding['2xl'] }}>
                {messageBlock}
                {buttons}
              </View>
            )}
          </SurfaceColorProvider>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
