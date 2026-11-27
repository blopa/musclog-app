import { Mic, SendHorizontal } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';

import { VoiceTranscriptModal } from '@/components/modals/VoiceTranscriptModal';
import { CenterNavButton } from '@/components/navigation/CenterNavButton';
import { VoiceListeningOverlay } from '@/components/navigation/VoiceListeningOverlay';
import { useVoiceCommands } from '@/context/VoiceCommandContext';
import { useAppSafeAreaInsets } from '@/hooks/useAppSafeAreaInsets';
import { useHoldToTranscribe } from '@/hooks/useHoldToTranscribe';
import { useLockedHoldGuards } from '@/hooks/useLockedHoldGuards';
import { NO_VOICE_DRAG, voiceDrag } from '@/utils/voiceInput';

/** The hold is read from press in and out; see `CenterNavButton`'s `onLongPress`. */
const keepHolding = () => {};

/** How far the microphone leans with a sliding finger: enough to feel it, short of the hints. */
const BUTTON_NUDGE = 14;

/** The button's box in the bar's row before its first layout: the bar's padding and an 80pt circle. */
const ESTIMATED_BUTTON_BOX = { y: 8, height: 80 };

type VoiceNavButtonProps = {
  /** The height of the screen the bar sits on; 0 until `MasterLayout` has measured it. */
  frameHeight: number;
};

/**
 * The bottom bar's centre microphone: hold to speak, let go to have Musclog act on it
 * (`VoiceCommandProvider`), or, with no AI ready, to see the text in a modal. Sliding the held
 * finger up locks the hold (the button then sends it), sliding down cancels it.
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
  /** Where the holding finger went down; null once its slide has nothing left to decide. */
  const startY = useRef<number | null>(null);
  const [drag, setDrag] = useState(NO_VOICE_DRAG);
  const {
    phase,
    locked,
    liveText,
    level,
    outcome,
    onPressIn,
    onPressOut,
    lock,
    cancel,
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

  useLockedHoldGuards(locked, cancel);

  const onButtonPressIn = (event: GestureResponderEvent) => {
    startY.current = locked ? null : event.nativeEvent.pageY;
    setDrag(NO_VOICE_DRAG);
    onPressIn();
  };

  const onButtonPressMove = (event: GestureResponderEvent) => {
    if (startY.current === null) {
      return;
    }

    const next = voiceDrag(event.nativeEvent.pageY - startY.current);
    if (next.action) {
      startY.current = null;
      setDrag(NO_VOICE_DRAG);
      if (next.action === 'lock') {
        lock();
      } else {
        cancel();
      }

      return;
    }

    setDrag((current) =>
      current.lock === next.lock && current.cancel === next.cancel ? current : next
    );
  };

  const onButtonPressOut = () => {
    startY.current = null;
    setDrag(NO_VOICE_DRAG);
    onPressOut();
  };

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
          locked={locked}
          drag={drag}
          onCancel={cancel}
          liveText={liveText}
          level={level}
          frameHeight={frameHeight > 0 ? frameHeight : windowHeight}
          bottomOffset={insets.bottom}
          buttonTop={buttonTop}
        />
      )}
      <CenterNavButton
        icon={locked ? SendHorizontal : Mic}
        accessibilityLabel={t(locked ? 'voiceInput.overlay.send' : 'common.a11y.holdToSpeak')}
        active={phase !== 'idle'}
        onPressIn={onButtonPressIn}
        onPressOut={onButtonPressOut}
        onPressMove={onButtonPressMove}
        offsetY={(drag.cancel - drag.lock) * BUTTON_NUDGE}
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
