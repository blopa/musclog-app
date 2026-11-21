import { ArrowLeft } from 'lucide-react-native';
import { ReactNode, RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, type ScrollViewInstance, Text, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import ConfettiOverlay from '@/components/ConfettiOverlay';
import { footerClearance } from '@/components/modals/footerClearance';
import { SwipeToReturnWrapper } from '@/components/SwipeToReturnWrapper';
import { Modal } from '@/components/theme/Modal';
import { useScrollFade } from '@/hooks/useScrollFade';
import { useTheme } from '@/hooks/useTheme';
import { useWebModalLayerStyle } from '@/utils/webPhoneFrame';

/** The room a header title asks for beside the back arrow; less than this and an action wraps. */
const HEADER_TITLE_BASIS = 140;

type FullScreenModalProps = {
  visible: boolean;
  onClose: () => void;
  onShow?: () => void;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
  showHeader?: boolean;
  closable?: boolean;
  scrollViewRef?: RefObject<KeyboardAwareScrollViewRef | null>;
  showConfetti?: boolean;
  /**
   * Whether Loggy pops in with the confetti. `false` on a surface the coach persona owns: someone who
   * picked Sherlock must not see Loggy appear in their chat.
   */
  confettiWithLoggy?: boolean;
  /**
   * Shows the "more below" cue (a fade into the surface and a chevron that scrolls to the end)
   * while the body runs past the screen. It sits above the footer. Off by default: most modals
   * are short, and a cue on all of them would be noise.
   */
  scrollCue?: boolean;
};

export function FullScreenModal({
  visible,
  onClose,
  onShow,
  title,
  subtitle,
  headerRight,
  children,
  scrollable = true,
  footer,
  showHeader = true,
  closable = true,
  scrollViewRef,
  showConfetti = false,
  confettiWithLoggy = true,
  scrollCue = false,
}: FullScreenModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  // The body's ref is the caller's when given; the cue's chevron scrolls the same scroller.
  const ownScrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const bodyRef = scrollViewRef ?? ownScrollRef;
  const { scrollProps, FadeIndicator } = useScrollFade(
    bodyRef as unknown as RefObject<ScrollViewInstance | null>
  );
  // Everything but the ref, which the body already has.
  const { ref: _cueRef, ...scrollHandlers } = scrollProps;
  const webModalStyle = useWebModalLayerStyle({ variant: 'fullscreen' });
  // The footer floats over the body, so the body pads by the footer's real height: a footer that
  // wraps (stacked buttons at large text or in a long translation) is taller than the fixed room
  // a one-row footer needs, and used to cover the last rows of the content.
  const [footerHeight, setFooterHeight] = useState(0);

  // Force remount of Modal when visibility changes to prevent "ghost" native window
  // that captures touches. See: https://github.com/facebook/react-native/issues/29455
  const [modalInstance, setModalInstance] = useState(0);
  const wasVisibleRef = useRef(visible);

  useLayoutEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setModalInstance((current) => current + 1);
    }

    wasVisibleRef.current = visible;
  }, [visible]);

  // Web-specific ScrollView styles to prevent browser gestures
  const webScrollViewStyle =
    Platform.OS === 'web'
      ? ({
          // Allow vertical scrolling but prevent horizontal browser gestures
          touchAction: 'pan-y',
        } as any)
      : {};

  return (
    <Modal
      key={Platform.OS !== 'web' ? `modal-${modalInstance}` : undefined}
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={closable ? onClose : undefined}
      onShow={onShow}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      <SafeAreaView
        edges={Platform.OS !== 'web' ? ['top', 'bottom'] : []}
        className="flex-1 bg-bg-primary"
        style={webModalStyle}
      >
        <SwipeToReturnWrapper
          onClose={onClose}
          enabled={closable}
          className="flex-1"
          pointerEvents="auto"
        >
          {/* Header */}
          {showHeader ? (
            <View className="border-b border-border-light bg-bg-primary">
              <View
                style={{
                  flexDirection: 'row',
                  // A wide action beside a long title (large text, a translation) drops to its own
                  // line instead of squeezing the title until it breaks mid-word.
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: theme.spacing.gap.sm,
                  minHeight: theme.size['14'],
                  paddingLeft: closable ? theme.spacing.padding.sm : theme.spacing.padding.base,
                  paddingRight: theme.spacing.padding.base,
                  paddingVertical: theme.spacing.padding.sm,
                }}
              >
                {closable ? (
                  <Pressable
                    accessibilityLabel={t('common.back')}
                    accessibilityRole="button"
                    style={{
                      padding: theme.spacing.padding.md,
                      borderRadius: theme.borderRadius.full,
                    }}
                    onPress={onClose}
                    hitSlop={4}
                  >
                    <ArrowLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
                  </Pressable>
                ) : null}
                <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: HEADER_TITLE_BASIS }}>
                  <Text className="text-lg font-semibold text-text-primary">{title}</Text>
                  {subtitle ? (
                    <Text className="mt-0.5 text-sm font-normal text-text-secondary">
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                {headerRight ? <View style={{ marginLeft: 'auto' }}>{headerRight}</View> : null}
              </View>
            </View>
          ) : null}

          {/* Content area */}
          <View className="flex-1" pointerEvents="box-none">
            {scrollable ? (
              <KeyboardAwareScrollView
                ref={bodyRef}
                {...(scrollCue ? scrollHandlers : {})}
                className="flex-1"
                showsVerticalScrollIndicator={false}
                style={webScrollViewStyle}
                contentContainerStyle={{
                  paddingBottom: footer
                    ? footerClearance(
                        footerHeight,
                        theme.spacing.padding['4xl'],
                        theme.spacing.padding.sm
                      )
                    : theme.spacing.padding.lg,
                }}
                bottomOffset={16}
              >
                {children}
              </KeyboardAwareScrollView>
            ) : (
              <View className="flex-1" pointerEvents="auto">
                {children}
              </View>
            )}

            {/* "more below" cue, above the footer that floats over the body */}
            {scrollCue ? (
              <View
                pointerEvents="box-none"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: footerHeight }}
              >
                {FadeIndicator}
              </View>
            ) : null}

            {/* optional footer */}
            {footer ? (
              <BottomButtonWrapper onHeightChange={setFooterHeight}>
                {footer}
                <View style={{ height: theme.spacing.margin.base }} />
              </BottomButtonWrapper>
            ) : null}
          </View>
        </SwipeToReturnWrapper>
      </SafeAreaView>
      {showConfetti ? <ConfettiOverlay withLoggy={confettiWithLoggy} /> : null}
    </Modal>
  );
}
