import { ChevronDown, ChevronUp, Lock, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { VoiceWaveform } from '@/components/navigation/VoiceWaveform';
import { IconButton } from '@/components/theme/IconButton';
import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { useAppSafeAreaInsets } from '@/hooks/useAppSafeAreaInsets';
import type { HoldToTranscribePhase } from '@/hooks/useHoldToTranscribe';
import { useTheme } from '@/hooks/useTheme';
import {
  voiceCaption,
  type VoiceCaptionSize,
  voiceCaptionSize,
  type VoiceDrag,
} from '@/utils/voiceInput';
import type { VoiceLevelMeter } from '@/utils/voiceLevel';

const FADE_MS = 160;

/** Under the microphone button (`CenterNavButton`, `z-10`), over every other part of the bar. */
export const VOICE_OVERLAY_Z_INDEX = 5;

/** The caption is already large; past this it would push the waveform off a small screen. */
const MAX_CAPTION_FONT_SCALE = 1.2;

const CAPTION_FONT_SIZE = {
  large: '3xl',
  medium: '2xl',
  small: 'xl',
} as const satisfies Record<VoiceCaptionSize, string>;

type VoiceListeningOverlayProps = {
  phase: Exclude<HoldToTranscribePhase, 'idle'>;
  /** The hold goes on without a finger: a cancel button replaces the slide hints. */
  locked: boolean;
  /** How far the held finger has slid towards locking or cancelling. */
  drag: VoiceDrag;
  onCancel: () => void;
  liveText: string;
  level: VoiceLevelMeter;
  /** The height of the screen the bar sits on (`MasterLayout`'s frame). */
  frameHeight: number;
  /** How far below the overlay's parent (the bar's row) the screen ends: the bar's bottom inset. */
  bottomOffset: number;
  /** From the screen's bottom edge to the top of the microphone button; the hint sits above it. */
  buttonTop: number;
};

/**
 * What a hold looks like: the whole screen dims, the microphone stays lit where the finger is, and
 * the middle shows what is being heard over a live waveform.
 *
 * It is a child of the bottom bar's row, not a modal: a native modal is a new window and would take
 * the held touch off the button, ending the hold. So it is positioned from the bar instead, down to
 * the screen's bottom edge and up the frame's full height, and stacked between the bar's other
 * buttons and the microphone (`VOICE_OVERLAY_Z_INDEX`). The scrim is the fixed dark one with fixed
 * white ink (docs/DESIGN.md → surfaces that do not follow the theme); the bars take the theme's
 * accent, like the microphone. It blocks taps on the screen under it until the hold is over.
 *
 * Above the button it says where to slide: up to the lock, down to cancel, each lighting up as the
 * finger gets there. A locked hold shows a cancel button instead, and the microphone below it has
 * become the send button.
 */
export function VoiceListeningOverlay({
  phase,
  locked,
  drag,
  onCancel,
  liveText,
  level,
  frameHeight,
  bottomOffset,
  buttonTop,
}: VoiceListeningOverlayProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useAppSafeAreaInsets();
  const caption = voiceCaption(liveText);
  const fontSize = theme.typography.fontSize[CAPTION_FONT_SIZE[voiceCaptionSize(caption)]];
  const finishing = phase === 'finishing';
  const hintGap = theme.spacing.padding.base;
  const hint = (text: string, color: string = theme.colors.overlay.alwaysWhite70) => (
    <Text
      maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
      className="text-center text-sm font-medium"
      style={{ color }}
    >
      {text}
    </Text>
  );

  return (
    <Animated.View
      entering={FadeIn.duration(FADE_MS)}
      exiting={FadeOut.duration(FADE_MS)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -bottomOffset,
        height: frameHeight,
        zIndex: VOICE_OVERLAY_Z_INDEX,
        backgroundColor: theme.colors.background.scrim90,
      }}
    >
      <View
        className="flex-1 items-center justify-center gap-8 px-6"
        style={{ paddingTop: insets.top + hintGap }}
      >
        <View className="w-full items-center" style={{ opacity: finishing ? 0.35 : 1 }}>
          <VoiceWaveform level={level} running={!finishing} color={theme.colors.accent.primary} />
        </View>
        <Text
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={MAX_CAPTION_FONT_SCALE}
          className="text-center font-semibold"
          style={{
            fontSize,
            lineHeight: Math.round(fontSize * theme.typography.lineHeight.tight),
            color: caption ? theme.colors.text.alwaysWhite : theme.colors.overlay.alwaysWhite70,
          }}
        >
          {caption || t('voiceInput.listening')}
        </Text>
      </View>
      <View
        className="items-center gap-4 px-6"
        style={{ paddingTop: hintGap, paddingBottom: buttonTop + hintGap }}
      >
        {finishing ? (
          <View className="flex-row items-center justify-center gap-2">
            <ActivityIndicator size="small" color={theme.colors.overlay.alwaysWhite70} />
            {hint(t('voiceInput.overlay.finishing'))}
          </View>
        ) : null}
        {!finishing && locked ? (
          <>
            <View className="items-center gap-2">
              <IconButton
                icon={Trash2}
                size="lg"
                variant="media"
                accessibilityLabel={t('common.cancel')}
                onPress={onCancel}
              />
              {hint(t('common.cancel'))}
            </View>
            {hint(t('voiceInput.overlay.lockedHint'))}
          </>
        ) : null}
        {!finishing && !locked ? (
          <View pointerEvents="none" className="items-center gap-4">
            <View className="items-center gap-2" style={{ opacity: 1 - drag.cancel }}>
              <View
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{
                  backgroundColor:
                    drag.lock >= 0.5 ? theme.colors.accent.primary : theme.colors.overlay.scrim60,
                  transform: [{ scale: 1 + drag.lock * 0.3 }],
                }}
              >
                <Lock size={theme.iconSize.lg} color={theme.colors.text.alwaysWhite} />
              </View>
              <ChevronUp size={theme.iconSize.md} color={theme.colors.overlay.alwaysWhite70} />
              {hint(t('voiceInput.overlay.slideUpToLock'))}
            </View>
            {hint(t('voiceInput.overlay.releaseHint'))}
            <View className="flex-row items-center justify-center gap-2">
              <ChevronDown
                size={theme.iconSize.sm}
                color={
                  drag.cancel > 0 ? theme.colors.status.error : theme.colors.overlay.alwaysWhite70
                }
              />
              {hint(
                t('voiceInput.overlay.slideDownToCancel'),
                drag.cancel > 0 ? theme.colors.status.error : undefined
              )}
            </View>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}
