import { Mic } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { VoiceTranscriptModal } from '@/components/modals/VoiceTranscriptModal';
import { CenterNavButton } from '@/components/navigation/CenterNavButton';
import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { useVoiceCommands } from '@/context/VoiceCommandContext';
import { useHoldToTranscribe } from '@/hooks/useHoldToTranscribe';
import { useTheme } from '@/hooks/useTheme';

/** The hold is read from press in and out; see `CenterNavButton`'s `onLongPress`. */
const keepHolding = () => {};

/**
 * The bottom bar's centre microphone: hold to speak, let go to have Musclog act on it
 * (`VoiceCommandProvider`), or, with no AI ready, to see the text in a modal.
 *
 * It returns a fragment so the caption can be an absolutely positioned child of the bar's
 * `relative flex-row` (it takes no part in the row's layout, so the button keeps its slot) that
 * floats just above the bar across its width.
 */
export function VoiceNavButton() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { ready, submit } = useVoiceCommands();
  const {
    phase,
    liveText,
    outcome,
    onPressIn,
    onPressOut,
    dismissOutcome,
    downloadLanguage,
    allowBrowserRecognition,
  } = useHoldToTranscribe({
    onText: (text) => {
      if (ready) {
        submit(text);
      }

      return ready;
    },
  });
  const showCaption = phase === 'listening' || phase === 'finishing';

  return (
    <>
      {showCaption ? (
        <View
          pointerEvents="none"
          className="absolute left-4 right-4 rounded-card border border-border-dark px-4 py-3"
          style={{
            bottom: '100%',
            marginBottom: theme.spacing.padding.base,
            backgroundColor: theme.colors.background.card,
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
            numberOfLines={4}
            className="text-base text-text-primary"
          >
            {liveText || t('voiceInput.listening')}
          </Text>
        </View>
      ) : null}
      <CenterNavButton
        icon={Mic}
        accessibilityLabel={t('common.a11y.holdToSpeak')}
        active={phase !== 'idle'}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onLongPress={keepHolding}
      />
      <VoiceTranscriptModal
        outcome={outcome}
        onClose={dismissOutcome}
        onDownloadLanguage={() => void downloadLanguage()}
        onAllowBrowser={() => void allowBrowserRecognition()}
      />
    </>
  );
}
