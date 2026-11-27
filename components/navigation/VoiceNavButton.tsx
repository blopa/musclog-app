import { Mic } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, useWindowDimensions } from 'react-native';

import { VoiceTranscriptModal } from '@/components/modals/VoiceTranscriptModal';
import { CenterNavButton } from '@/components/navigation/CenterNavButton';
import { VoiceListeningOverlay } from '@/components/navigation/VoiceListeningOverlay';
import { useVoiceCommands } from '@/context/VoiceCommandContext';
import { useAppSafeAreaInsets } from '@/hooks/useAppSafeAreaInsets';
import { useHoldToTranscribe } from '@/hooks/useHoldToTranscribe';

/** The hold is read from press in and out; see `CenterNavButton`'s `onLongPress`. */
const keepHolding = () => {};

/** The button's box in the bar's row before its first layout: the bar's padding and an 80pt circle. */
const ESTIMATED_BUTTON_BOX = { y: 8, height: 80 };

type VoiceNavButtonProps = {
  /** The height of the screen the bar sits on; 0 until `MasterLayout` has measured it. */
  frameHeight: number;
};

/**
 * The bottom bar's centre microphone: hold to speak, let go to have Musclog act on it
 * (`VoiceCommandProvider`), or, with no AI ready, to see the text in a modal.
 *
 * While a hold runs, `VoiceListeningOverlay` dims the whole screen under the button. It returns a
 * fragment so the overlay is an absolutely positioned child of the bar's `relative flex-row`
 * (it takes no part in the row's layout, so the button keeps its slot).
 */
export function VoiceNavButton({ frameHeight }: VoiceNavButtonProps) {
  const { t } = useTranslation();
  const { ready, submit } = useVoiceCommands();
  const insets = useAppSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [buttonBox, setButtonBox] = useState(ESTIMATED_BUTTON_BOX);
  const {
    phase,
    liveText,
    level,
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

  const onButtonLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setButtonBox((current) =>
      current.y === y && current.height === height ? current : { y, height }
    );
  };

  // The row's padding is even, so the space under the button is its offset from the row's top;
  // the bar then pads the screen's bottom inset (`NavigationMenu`).
  const buttonTop = insets.bottom + buttonBox.y + buttonBox.height;

  return (
    <>
      {phase === 'idle' ? null : (
        <VoiceListeningOverlay
          phase={phase}
          liveText={liveText}
          level={level}
          frameHeight={frameHeight > 0 ? frameHeight : windowHeight}
          bottomOffset={insets.bottom}
          buttonTop={buttonTop}
        />
      )}
      <CenterNavButton
        icon={Mic}
        accessibilityLabel={t('common.a11y.holdToSpeak')}
        active={phase !== 'idle'}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onLongPress={keepHolding}
        onLayout={onButtonLayout}
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
