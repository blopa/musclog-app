import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { VoiceWaveform } from '@/components/navigation/VoiceWaveform';
import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { useAppSafeAreaInsets } from '@/hooks/useAppSafeAreaInsets';
import type { HoldToTranscribePhase } from '@/hooks/useHoldToTranscribe';
import { useTheme } from '@/hooks/useTheme';
import { voiceCaption, type VoiceCaptionSize, voiceCaptionSize } from '@/utils/voiceInput';
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
 */
export function VoiceListeningOverlay({
  phase,
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
        style={{ paddingTop: insets.top + hintGap, paddingBottom: buttonTop + hintGap * 4 }}
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
        pointerEvents="none"
        className="absolute left-0 right-0 flex-row items-center justify-center gap-2 px-6"
        style={{ bottom: buttonTop + hintGap }}
      >
        {finishing ? (
          <ActivityIndicator size="small" color={theme.colors.overlay.alwaysWhite70} />
        ) : null}
        <Text
          maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          className="text-center text-sm font-medium"
          style={{ color: theme.colors.overlay.alwaysWhite70 }}
        >
          {t(finishing ? 'voiceInput.overlay.finishing' : 'voiceInput.overlay.releaseHint')}
        </Text>
      </View>
    </Animated.View>
  );
}
